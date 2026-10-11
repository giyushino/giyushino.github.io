---
title: How to train your model (distributedly)
date: 2026-10-10
tag: technical
readingTime: ?? min
blurb: An simple guide into distributed training
---
![dragon](https://miro.medium.com/v2/resize:fit:1400/1*X3Es7B6IFbe7ZzPEdtmHRA@2x.jpeg "Us taming distributed training once and for all")

I spent most of my summer writing a [distributed training stack](https://github.com/giyushino/torchure),
and I'm currently recruiting for machine learning engineering positions, so
what's a better way to prep than writing a blog post?

## Setting the Scene
We're a group of engineers at AllanAI, and we're helping with the development of
the Allan family of models: a 1B model and a 20B-A1B model. The research
team is hard at work on research stuff, so it's up to us to make sure everything
related to training infra goes smoothly!

## Single GPU Training
Since we're _real_ engineers, we're going to reinvent the wheel and write a
training stack from scratch. We already have the model code and dataloader implemented, so
it's pretty easy to write a training loop.
```python
def train(train_cfg: dict):
    model = AllanLLM(train_cfg["model_size"])
    dataloader = AllanDataloader("/path/to/agi")
    optimizer = torch.optim.AdamW(train_cfg["optimizer"])

    for _ in range(train_cfg["num_steps"]):
        batch = next(dataloader)    
        out = model(batch)
        loss 
```






