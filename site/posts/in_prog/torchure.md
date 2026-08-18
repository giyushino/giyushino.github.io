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

