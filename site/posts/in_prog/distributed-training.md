---
title: How to train your model (distributedly)
date: 2026-10-10
tag: technical
readingTime: ?? min
blurb: An simple guide into distributed training
---
![dragon](https://miro.medium.com/v2/resize:fit:1400/1*X3Es7B6IFbe7ZzPEdtmHRA@2x.jpeg "Us taming distributed training once and for all")

I spent most of my summer writing a [distributed training stack](https://github.com/giyushino/torchure),
and am currently recruiting for machine learning engineering positions,
so now is the perfect time to write a blog about all of this!


This post will mainly be about distributed training,
but I'll start with a brief introduction into how
training works in general.

Let's start with 
