---
title: "How I Built My Personal Website and Blog"
date: 2025-01-15
slug: how-i-built-my-personal-website-and-blog
---

Peace be upon you,

In this article, I wanted to share my journey of building my personal website and blog. Starting from the reason that pushed me to create this project, all the way to the tools and technologies I used, the challenges I faced, and the future plans I hope to achieve.

## The Beginning: A Problem That Pushed Me to Build a Solution

The idea for this project started from a personal experience with the platform [ghost.org](http://ghost.org). I ran into a problem that made me realize something important: when we rely on platforms that store our data, that data is not truly ours.

That realization became very real when my trial on the platform expired and my articles were deleted, and I was asked to pay in order to restore content that I originally wrote myself.

To be fair, part of the mistake was mine. I didn’t pay attention to the emails that were sent to my inbox warning me about the trial ending. But the experience still pushed me to build something different: a personal blog inside my own website where I have full control over my data and can make sure it stays in safe hands.

## Tools and Technologies Used

To build my website, I relied on several modern technologies while adding some personal touches along the way.

### 1. Next.js

I chose **Next.js** as the main framework for developing the website because of its strong support for multiple rendering strategies such as **SSR, ISR, and CSR**. It’s also very easy to set up and work with, while still preserving the core React experience with a number of useful improvements.

### 2. Tailwind CSS

For the UI design, I used **Tailwind CSS**. It provides a flexible and fast way to build responsive and elegant interfaces without unnecessary complexity.

### 3. TipTap

For the blog editor, I used **TipTap** as the base rich text editor and extended it with several custom features to match my needs.

**Image Upload**

The editor supports drag-and-drop image uploads with an instant preview. The image is first converted into **Base64** for preview, then uploaded in the background using **Tigris Storage**, which provides **S3-compatible storage** and also acts as a CDN for better performance.

**Autosave**

The autosave system relies on **stroke detection** combined with a **debounce strategy** to reduce unnecessary requests while making sure writing progress is saved smoothly during editing.

### 4. Tigris Storage

Instead of using **AWS S3** directly, I chose **Tigris Storage** because of its simple S3 integration and its ability to distribute files to locations closer to the user. This improves performance while keeping the setup relatively simple.

### 5. Framer Motion

I added subtle animations using **Framer Motion**, such as **fade-in transitions** when navigating between pages. These small visual touches make the browsing experience feel smoother and more dynamic.

### 6. Zustand

Initially, I considered managing the application **state** manually, but I quickly ran into issues such as **race conditions** and **prop drilling**, which added unnecessary complexity to the project.

Because of that, I decided to use **Zustand**, which provides a predictable and efficient state management approach. One of its biggest advantages is its **centralized store**, creating a **single source of truth** for the application state.

This approach significantly reduces the need to pass state across multiple components or write complex logic inside each component. Instead, everything lives in a central place, making the codebase easier to maintain and reason about.

I strongly recommend avoiding manual state management for anything beyond very simple projects. I learned the hard way that trying to control everything yourself is not always the best solution. 😅

## How I Hosted the Project on the Cloud

What you're currently viewing is my website hosted on **Vercel** (which hasn’t been the best experience so far — I’ll talk about its issues in a future article).

The blog content itself is stored in a **PostgreSQL** database.

I intentionally chose **not to use Static Site Generation (SSG)** for the blog. While SSG could reduce infrastructure costs, avoiding it gives me much more flexibility in how I manage and render my content.

I haven’t fully taken advantage of that flexibility yet, but I definitely plan to in the future.

As mentioned earlier, images are stored using **S3-compatible storage through Tigris**, rather than relying on AWS directly.

Below is a screenshot from my **X (Twitter)** account when I published the first article on this blog.

## Challenges and Future Plans

Even though the current system works very well, there are still a few areas I want to improve.

For example, I want to further refine the **autosave mechanism** in the editor to make it more accurate and reliable. I also want to improve the **automatic Markdown formatting**, as it still needs some refinement to feel smoother and more consistent.

As for the future:

One idea I’m considering is open-sourcing some parts of the project as independent libraries. Some components such as the **custom cursor system** and the **text editor** have fairly advanced implementations and good performance, so they could potentially be useful for other developers as standalone packages.

Another goal is to evolve the editor into a **fully independent library** that developers can easily integrate and customize within their own projects.

I also plan to add an **email subscription feature**, so whenever a new article is published, subscribers will receive it directly in their inbox.

Finally, I will enable an **RSS feed** so readers can follow new posts automatically using their preferred RSS readers.

## Closing Thoughts

Building my personal website and blog has been both challenging and enjoyable.

If you’re thinking about building something similar, my advice is simple: use the tools that actually fit your needs, and avoid unnecessary complexity.

Most importantly, enjoy the process and learn from every step along the way.

Thank you for your time, and I hope you found something useful in this article.

If you encounter any issues while reading the article, such as unclear text or other problems, I would be very happy to hear about it.

*This English version of the article was translated with the help of AI. Because the original post was written in Arabic, some nuances and details may not have carried over perfectly into the translation. For the most accurate version, you may prefer reading the original Arabic post.*