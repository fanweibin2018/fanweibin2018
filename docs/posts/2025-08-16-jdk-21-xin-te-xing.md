---
title: 'JDK 21 新特性'
date: 2025-08-16
slug: 'jdk-21-xin-te-xing'
categories:
  - 'Java 技术'
tags:
  - 'JDK 21'
  - '虚拟线程'
  - '结构化并发'
  - '模式匹配'
  - 'Record'
  - 'LTS'
source: halo
description: '随着 Java 21 的发布，作为长期支持（LTS）版本，它带来了许多令人兴奋的新特性。这些新特性不仅增强了 Java 语言的功能性，也提升了开发者的编程体验。本文将深入解析 JDK 21 的主要新特性，帮助开发者快速了'
---

# JDK 21 新特性

随着 Java 21 的发布，作为长期支持（LTS）版本，它带来了许多令人兴奋的新特性。这些新特性不仅增强了 Java 语言的功能性，也提升了开发者的编程体验。本文将深入解析 JDK 21 的主要新特性，帮助开发者快速了解和掌握这些重要更新。

# 1. 虚拟线程（Virtual Threads）

虚拟线程是 JDK 21 中最引人注目的特性之一，它极大地简化了高吞吐量并发应用程序的编写。

## **核心概念**

虚拟线程是一种轻量级线程，由 JVM 管理而不是操作系统。与传统的平台线程相比，虚拟线程具有以下优势：

- 极低的内存占用（每个线程只需几百字节）
- 几乎无限的数量（仅受可用内存限制）
- 无需池化即可高效创建和销毁

## 使用示例

```
// 创建虚拟线程
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    List<CompletableFuture<String>> futures = IntStream.range(0, 10_000)
        .mapToObj(i -> CompletableFuture.supplyAsync(() -> {
            // 模拟IO操作
            try {
                Thread.sleep(1000);
                return "Task " + i + " completed";
            } catch (InterruptedException e) {
                throw new RuntimeException(e);
            }
        }, executor))
        .toList();
    
    // 等待所有任务完成
    CompletableFuture.allOf(futures.toArray(new CompletableFuture[0]))
        .join();
}
```

# 2. 结构化并发（Structured Concurrency）

结构化并发旨在简化多线程错误处理和取消操作，使并发代码更加可靠和可读。

## 核心概念

结构化并发通过 StructuredTaskScope 提供了一种结构化的方式来管理多个并发任务，确保：

- 任务的生命周期得到正确管理
- 错误能够正确传播
- 取消操作能够传播到所有子任务

## 使用示例

```
// 使用结构化并发处理多个任务
String fetchData() throws ExecutionException, InterruptedException {
    try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
        StructuredTaskScope.Subtask<String> userTask = scope.fork(() -> fetchUserDetails());
        StructuredTaskScope.Subtask<Integer> orderTask = scope.fork(() -> fetchOrderCount());
        
        scope.join();           // 等待所有子任务完成
        scope.throwIfFailed();  // 如果有任何子任务失败则抛出异常
        
        // 组合结果
        return userTask.get() + " has " + orderTask.get() + " orders";
    }
}
```

# 3. 模式匹配增强（Pattern Matching）

JDK 21 继续增强了模式匹配功能，使代码更加简洁和安全。

## Switch 模式匹配

```
// 增强的switch表达式支持模式匹配
String processObject(Object obj) {
    return switch (obj) {
        case String s && s.length() > 10 -> "Long string: " + s.substring(0, 10) + "...";
        case String s -> "Short string: " + s;
        case Integer i && i > 0 -> "Positive number: " + i;
        case Integer i -> "Non-positive number: " + i;
        case null -> "Null value";
        default -> "Unknown type: " + obj.getClass().getSimpleName();
    };
}
```

# 4. 字符串模板（String Templates）

字符串模板（预览特性）提供了一种安全且易读的方式来创建字符串。

## 核心概念

通过 STR 模板处理器，可以安全地嵌入表达式到字符串中：

```
// 字符串模板示例
String name = "Alice";
int age = 30;
double salary = 75000.50;

// 使用模板字符串
String message = STR."Hello, \{name}! You are \{age} years old and earn $\{salary} annually.";

System.out.println(message);
// 输出: Hello, Alice! You are 30 years old and earn $75000.5 annually.
```

# 5. Sequenced Collections（有序集合接口）

JDK 21 引入了新的接口来统一处理有序集合。

## 核心概念

引入了 SequencedCollection、SequencedSet 和 SequencedMap 接口，提供了统一的有序集合操作：

```
// 使用SequencedCollection
SequencedCollection<String> collection = new ArrayList<>();
collection.addFirst("First");
collection.addLast("Last");

// 反转视图
SequencedCollection<String> reversed = collection.reversed();
System.out.println(reversed); // [Last, First]

// SequencedMap示例
SequencedMap<String, Integer> map = new LinkedHashMap<>();
map.put("one", 1);
map.put("two", 2);
map.put("three", 3);

// 获取第一个和最后一个条目
System.out.println(map.firstEntry());  // one=1
System.out.println(map.lastEntry());   // three=3
```

# 6. Scoped Values（作用域值）

Scoped Values 提供了一种在线程及其子线程间共享不可变数据的机制。

## 核心概念

相比 ThreadLocal，ScopedValue 提供了更安全和高效的数据共享方式：

```
// 定义ScopedValue
private static final ScopedValue<String> USER_ID = ScopedValue.newInstance();

// 使用ScopedValue
public void processWithUserId(String userId) throws Exception {
    ScopedValue.where(USER_ID, userId)
        .run(() -> {
            // 在这个作用域内，所有代码都可以访问USER_ID
            performOperation();
            processSubTasks();
        });
}

private void performOperation() {
    // 获取当前作用域中的值
    String userId = USER_ID.get();
    System.out.println("Processing for user: " + userId);
}
```

# 7. 异步堆栈跟踪（Async Stack Trace）

JDK 21 增强了异步操作的堆栈跟踪能力，使调试异步代码更加容易。

## 核心概念

通过增强的堆栈跟踪机制，可以更好地追踪异步操作的调用链：

```
// 异步操作示例
CompletableFuture<String> future = CompletableFuture.supplyAsync(() -> {
    // 模拟异常
    throw new RuntimeException("Async operation failed");
});

try {
    future.join();
} catch (CompletionException e) {
    // JDK 21 提供了更好的异步堆栈跟踪信息
    e.printStackTrace();
}
```

# 8. Record 模式匹配（Record Patterns）

Record 模式匹配允许在 instanceof 检查和 switch 表达式中解构 Record 对象。

## 核心概念

```
// 定义Record
record Person(String name, int age) {}

// Record模式匹配
void processPerson(Object obj) {
    // instanceof中的Record模式
    if (obj instanceof Person(String name, int age)) {
        System.out.println("Person: " + name + ", Age: " + age);
    }
    
    // switch中的Record模式
    switch (obj) {
        case Person(String name, int age) && age >= 18 -> 
            System.out.println(name + " is an adult");
        case Person(String name, int age) -> 
            System.out.println(name + " is a minor");
        default -> 
            System.out.println("Not a person");
    }
}
```

# 小结

JDK 21 作为新的 LTS 版本，带来了许多重要的新特性，这些特性主要集中在以下几个方面：

1. 并发编程增强：虚拟线程和结构化并发大大简化了并发编程的复杂性
2. 语言表达力提升：模式匹配、字符串模板等特性让代码更加简洁易读
3. API 完善：有序集合接口和作用域值等提供了更好的编程模型
4. 调试和维护性改善：异步堆栈跟踪等功能提升了开发体验

这些新特性不仅增强了 Java 语言的功能，也为开发者提供了更好的工具来构建现代化、高性能的应用程序。建议开发者逐步学习和应用这些新特性，在实际项目中体验它们带来的便利。

随着 JDK 21 的广泛应用，我们可以期待 Java 生态系统将迎来新一轮的发展和创新。
