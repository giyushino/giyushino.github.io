---
title: Torchure, My Very Own Training Stack!
date: 2026-08-16
tag: technical
readingTime: ?? min
blurb: An in depth look into distributed training
---
After putting this project off for months, I finally opened Neovim and 
started writing my own distributed training stack, [Torchure](https://github.com/giyushino/torchure).
Despite the name, *most* of the development process wasn't torture, and I'd love to share
my experience and hopefully teach you something about distributed training along the way.

## The Basics
Training a classification model is generally pretty simple. We need to
1. Initialize our model (and dataloader + optimizer)
2. Iterate through the dataloader
3. Pass the batch through the model to obtain the logits
4. Compute the loss between the model predictions
and ground truths
5. Zero out the optimizer gradients
6. Trigger backpropogation
7. Update the model weights

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim

model = myModel(**model_cfg)
dataloader = myDataloader(**dataloader_cfg)
optimizer = torch.optim.AdamW(model.parameters(), lr=3e-4)

for epoch in range(epochs):
    for batch in dataloader:
        batch = batch.to(device)
        logits = model(batch)
        B, S, V = logits.shape

        labels = torch.full_like(batch, IGNORE_INDEX)
        labels[:, :-1] = batch[:, 1:]

        loss = F.cross_entropy(
            logits.reshape(-1, V),
            labels.reshape(-1),
            ignore_index=IGNORE_INDEX,
        )

        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
```

```python
import torch
import torch.nn as nn

from torchure.core.collective import MeshLike, all_reduce, broadcast


class _Bucket:
    def __init__(self, params: list[nn.Parameter]):
        self.params = params
        self.pending = len(params)
        self.flat = None
        self.views = None
        if len(params) > 1:
            numel = sum(p.numel() for p in params)
            self.flat = torch.empty(
                numel, dtype=params[0].dtype, device=params[0].device
            )
            self.views = []
            offset = 0
            for p in params:
                self.views.append(self.flat[offset: offset + p.numel()].view_as(p))
                offset += p.numel()


class DDP:
    def __init__(self, model: nn.Module, mesh: MeshLike, dim="dp", bucket_mb=25):
        self.mesh = mesh
        self.dim = dim
        self.group_size = mesh.size(dim)
        self._works = []
        self.requires_sync = True

        if self.group_size == 1:
            return

        self._replicate(model)
        params = [param for param in model.parameters() if param.requires_grad]
        params.reverse()
        # 1024 * 1024 is the number of bytes in mb
        self._buckets = self._build_buckets(params, int(bucket_mb * 1024 * 1024))
        self._bucket_of = {p: b for b in self._buckets for p in b.params}
        for param in params:
            param.register_post_accumulate_grad_hook(self._on_grad_ready)

    def _build_buckets(
        self, 
        params: list[nn.Parameter], 
        max_bucket_bytes: int
    ) -> list[_Bucket]:
        """
        params should already be revesed when passed into this function
        """
        buckets = []
        run = []
        run_bytes = 0

        for param in params:
            n_bytes = param.numel() * param.element_size()
            if run and (run_bytes + n_bytes > max_bucket_bytes or param.dtype != run[0].dtype):
                buckets.append(_Bucket(run))
                run = []
                run_bytes = 0
            run.append(param) 
            run_bytes += n_bytes

        if run:
            buckets.append(_Bucket(run))
      
        return buckets

    def _on_grad_ready(self, param: nn.Parameter) -> None:
        if not self.requires_sync:
            return

        bucket = self._bucket_of[param]
        bucket.pending -= 1
        if bucket.pending == 0:
            self._launch(bucket)

    def _launch(self, bucket: _Bucket) -> None:
        bucket.pending = len(bucket.params)
        if bucket.flat is None:
            grad = bucket.params[0].grad
        else:
            torch._foreach_copy_(bucket.views, [param.grad for param in bucket.params])
            for param, view in zip(bucket.params, bucket.views, strict=True):
                param.grad = view
            grad = bucket.flat
        _, work = all_reduce(grad, self.mesh, self.dim, "avg", async_op=True)
        self._works.append(work)
         
    @property
    def shard_dims(self) -> tuple[str, ...]:
        """
        mesh axes across which this strategy shards param/grad state -- none,
        for ddp: every rank holds a full replica and the all_reduce leaves each
        `.grad` complete.

        the trainer hands this straight to clip_grad_norm, so the parallelism
        strategy owns the answer instead of the training loop branching on
        which one it is. fsdp2 returns ("dp_shard",) here.
        """
        return ()

    def _replicate(self, model: nn.Module):
        for tensor in [*model.parameters(), *model.buffers()]:
            broadcast(tensor.detach(), self.mesh, self.dim, src=0)

    def sync(self) -> None:
        if self.group_size == 1:
            return
        assert len(self._works) == len(self._buckets), (
            f"only {len(self._works)}/{len(self._buckets)} grad buckets launched -- "
            "either a param got no grad this backward (frozen param), or "
            "requires_sync was still False on the last microbatch of an "
            "accumulation step (it must be True for exactly the last one)"
        )
        for work in self._works:
            work.wait()
        self._works.clear()


if __name__ == "__main__":
    print("1")

```


## Resources
Listed in no particular order are resources that cover
distributed training
1. [Introduction to parallelism in PyTorch - George Grigorev](https://ggrigorev.me/posts/introduction-to-parallelism/)
2. [Collective Operations - Aleksa Gordić](https://www.aleksagordic.com/blog/collective-operations)
3. [TorchTitan - Meta](https://arxiv.org/abs/2410.06511)
4. [Pipeline-Parallelism: Distributed Training via Model Partitioning - Simon Boehm](https://siboehm.com/articles/22/pipeline-parallel-training)

