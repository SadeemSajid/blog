---
description: Exploring the concept behind low-latency, high-throughput networking in modern data centers, and how it compares against the traditional networking stack.
---

# An Introduction to Remote Direct Memory Access.
18th July, 2025


With the rise of AI, or perhaps the race for “better” AI, development techniques alone are not enough to give one an edge in this race. A lot of factors go into determining how optimised your AI workflows are, especially when it comes to training times for LLMs. A key factor that determines training times is how fast you can move data across the different nodes in your cluster. Therefore, I think it is worthwhile to discuss these datacenter networks and the technologies being used to optimise data movement. The descriptions below are a bit simplistic for the sake of explanation.

## Traditional Networking

Traditionally, the nodes in a local cluster run on the Linux kernel, which has its own TCP/IP networking stack. When a user application intends to send data over a network, it opens a socket and passes the relevant data to it. This, in turn, invokes a system call which copies the data in the kernel’s networking stack, processes the data, encapsulates it in the relevant headers, and then copies it into the network interface card’s (NIC) buffers to be sent over the network. On the remote end, the same process happens but in reverse, and the packets are de-encapsulated and delivered to the user space application. This is good for normal use, but in high-throughput, low-latency environments, like training LLMs, this can be quite problematic.

You can already notice that there are several overheads here. The first overhead is the repetitive copying of data between different software layers in the user space and the NIC hardware. This consumes several CPU cycles to copy data between the different layers. The second major overhead is the context switch required for sending data. The user space app needs to use privileged methods to be able to interact with the NIC hardware and send packets over the network. Therefore, sending data requires the CPU to be interrupted, switch context to privileged kernel mode, and then copy the data from the sockets to the NIC hardware and then switch back to user mode. These context switches happen every time we wish to send data over the network, thus wasting important CPU cycles which could’ve been better utilised.

These overheads eventually become a bottleneck of how fast the processor can process data packets, with speeds being limited at around 20 - 30 Gb/s. We thus needed a way to overcome these limitations of repeated copies and CPU involvement with continuous context switches.

## DMA & Separate Planes

One of the solutions to this problem was to introduce the concept of Direct Memory Access (DMA). The concept is simple: the user space app can directly access NIC data buffers in the user space, without involving the CPU for data transfers and without having to perform a context switch. Before this can happen, however, the application must set up the appropriate resources and permissions which allow it to access the hardware buffers directly. This is made possible by separating the networking procedure into distinct paths: the control plane and the data plane.

The control plane simply refers to the “normal” path a privileged command takes: from the user space to the kernel, with a context switch. We can use the control plane to set up appropriate permissions, resources (like sockets) and connections using the kernel and the NIC before the actual data transfer. Once that is done, and we have access to the hardware buffers with appropriate permissions, we use the data plane for the data transfer and processing. The data plane simply allows you to access packets in the NIC directly by bypassing the kernel completely, which thus excludes the use of the CPU for data movement. This is called *kernel bypass*. Moreover, we don’t need to copy data anymore between different software layers either, and this concept is called *zero-copy*. A common implementation of this idea is Intel’s *Data Plane Development Kit* (DPDK). The packet path in DPDK is illustrated as:

<img title="" src="https://lh7-rt.googleusercontent.com/docsz/AD_4nXdV5SrYPUdNOvFFozLuQdcXXwCAvv-O9OKa_MzwSVCke77pTWmZOt0P3LDy0J0Amp6L5uK0UCjq4fgRNyTGk8-x8ufoWMyzS1W_V-S0Lqepu4PLe9Pj6Z4Um4zhR0UqxAEoHQdDmA?key=M55uWqopXmBzDmc5R3A7HA" alt="" width="550" data-align="center">

This gives us very good speed-ups compared to the traditional kernel. You can read a nice report linked as well[^1], comparing HTTP requests per second with the DPDK. Here is a diagram I took from the article. You can see that DPDK is capable of processing around *1.5 million HTTP requests* per second, compared to the vanilla kernel.

<img title="" src="https://lh7-rt.googleusercontent.com/docsz/AD_4nXcgPdTyRL5fJO_Wy1Jd0e8Ywut-wCInfHpFVpcVor3rsu-GExckztPjMw_uXO-3C8AKxLbBE8WILrFYuwgRBwxKFyeTDaTYInsYSieYs7gMr1BPyOBue-76OgMvzj_0AuB4cUoBsA?key=M55uWqopXmBzDmc5R3A7HA" alt="" data-align="center" width="550">

## RDMA: The Next Step

Apparently, that wasn’t enough for high-performance computing nerds. DMA allows us to perform zero-copy, kernel-bypass in the data plane only on the local node. So they thought: what if a remote node can *directly* transfer memory into *your* user space? That way, we can get rid of whatever customs exist between nodes sharing data in a cluster. No kernel or CPU would be involved in the remote end, and the data would be there in its memory, without it even knowing that it's there. Thus, the idea of Remote Direct Access Memory (RDMA) was born. RDMA, as the name suggests, allows you to directly transfer memory in and out of a remote host, without potentially involving the remote end’s CPU. This, of course, requires specialised NIC hardware.

RDMA uses several key concepts to achieve this behavior, all of which are essentially packaged in what we call *Verbs*. The verbs, much like an API, allow you to interact with the underlying RDMA-enabled NIC to set up important resources or RDMA functionality. Before I explain these resources, we should see what kind of operations RDMA supports. There are two main types of operations: two-sided operations and one-sided operations.

### RDMA operations

Two-sided means that these operations require both the local and remote ends to engage in the transfer, and are aware of the operation. The main element to note here are the Send and Receive operations. Simply put, the local end *prepares* and sends some data to the remote host, which receives the data and places it in the specified memory buffers.  One-sided operations are those that do not require the remote end to be aware of the data transfer. These are often called RDMA operations as well. These include the RDMA Read/Write and Atomic operations. Read and write operations directly read from and write to remote memory without notifying the remote end. Atomic operations perform operations like compare and swap, and fetch and add directly on remote memory by sending operands over the network.

As cool as it sounds, this introduces serious security concerns for the nodes involved in the network: you can alter remote memory without the host finding out about it…To address this, RDMA implementations like Infiniband require the participants to set up important resources that govern RDMA functionalities. These resources must be properly registered and set up on both ends before any communication can take place. In most cases, this requires specialized RDMA-enabled NICs like NVIDIA’s  *Mellanox* NIC. 

### RDMA resources

One of the first things an application needs to do is register a *Protection Domain*(PD). The PD holds all of the resources registered for a port in an NIC, and resources cannot use resources from other PDs. This enforces a high-level encapsulation mechanism to keep different RDMA resources separate. Any resources that will be registered from here on will have to be associated with a PD. 

The next important resource is a *Memory Region* (MR). An MR essentially houses the memory you want your NIC to use to transfer data to and from. You can set appropriate permissions for this region to allow or disallow different types of access. A successful registration will yield two keys: the LKEY and RKEY. The LKEY is used to validate local access and writes to the memory. The RKEY is sent to the remote end out of band to validate access to the remote memory in its RDMA operations. This, along with some other resources, manages to enforce some form of protection and isolation of resources against un-warranted access and manipulation.

One of the most important resources here is the Queue Pair (QP). The QP is an implementation of a FIFO queue on the NIC hardware. The QP accepts independent units of work, called Work Requests, from the user application that perform a specified operation. The QP is divided into send and receive queues. RDMA operations must all be posted on the send queue, as well as the send operation. These operations must specify memory buffers from which to *gather* data to be used for memory operations. Only the receive operation requires a work request to be posted to the receive queue, which must specify memory buffers to which to *scatter* the incoming data. Thus, the memory buffers are altogether called *scatter/gather elements* in RDMA.

## Final Words

RDMA provides a low-latency, high-throughput networking capability for high-speed environments. In the real world, RDMA has several different implementations. Two of the most common ones are *Infiniband* and *RDMA over Converged Ethernet version 2* (RoCE v2). Infiniband has its own network architecture, while RoCE v2 utilises the traditional UDP/IP stack. Moreover, the verbs that govern these operations are now built into the linux kernel, in a library called libibverbs. The rdma-core project on Github hosts most of the code related to RDMA in the linux kernel. I’ll hopefully be writing more about RoCE v2 and writing applications using that implementation some time in the future.

[^1]: https://talawah.io/blog/linux-kernel-vs-dpdk-http-performance-showdown/
