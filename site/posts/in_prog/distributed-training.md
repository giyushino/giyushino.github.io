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
what's a better way to prep than to write a blog post?

## Background
If you're already familiar with model training and just want to
read about distributed training, feel free to skip to the [next section](#setting-the-scene)!

When training an LLM, there are two main performance metrics we
care about:

1. Tokens Per Second (TPS)
1. Model FLOPs Utilization (MFU)

TPS is pretty self explanatory, it's the number of tokens we
train on per second per GPU
$$
\text{TPS} = \frac{\text{num tokens}}{\Delta t \times \text{num GPUs}}
$$

MFU is TPS times a constant for a fixed model and hardware. It's  the
number of FLOPs per token times TPS divided by the GPUs' peak potential FLOPs
$$
\text{MFU} =\frac{\text{FLOPs per token} \times \text{TPS}}{\text{Peak FLOPs per GPU}}\
$$
FLOPs per token roughly works out to be $6N$, 
where $N$ is the number of parameters in the model. Approximately $2N$ FLOPs
are used in the forward pass, and $4N$ flops for the backwards

With these two measurements in hand, we can determine how "good" our training
stack performance is (we always want moaarrrrr TPS and MFU). But how exactly
can we control this?

When training on GPUs, we spend most of our time computing and moving data. 
If we're constantly running large matrix multiplies with no breaks, we're
compute bound. We're paying a lot for these FLOPs, so we want to use them all!

Otherwise we might be waiting for data to be moved to the GPUs, which causes
them to sit idle. Data movement takes many shapes (CPU to GPU, reading from
GPU memory), but during training, we care about the communication between GPUs and nodes.
Within a node, GPUs can transmit information very quickly using technology like NVLink,
but transfer is much slower across nodes. 

The key to goooood TPS is to hide this communication somehow, and I'll
walk you through how we can do this.


## Setting the Scene
We're a group of engineers at AllanAI, and we're helping with the development of
the Allan family of models: a 600M dense model and a 20B-A1B MoE model. The research
team is hard at work on research stuff, so it's up to us to make sure everything
related to training infra goes smoothly!

### Training Allan-1B
The research team finished curating the pretraining set, and our clutch CTO secured us a bunch of H100s SXMs!
We already did a lot of testing to optimizing TPS on one GPU, so let's get to scaling. We spent a lot
of time optimizing the training loop on one GPU, where we achieved 8500 TPS. Since we're training on H100s,





