---
title: 'Spring Boot 4.0 全面升级指南：拥抱现代化 Java 企业开发'
date: 2025-11-10
slug: 'spring-boot-4.0-quan-mian-sheng-ji-zhi-nan-yong-bao-xian-dai-hua-java-qi-ye-kai-fa'
categories:
  - 'Java 技术'
tags:
  - 'Spring Boot'
  - 'Spring Framework'
  - 'Jakarta EE'
  - '版本升级'
source: halo
description: '当前版本：4.0.0 RC2（候选发布版） 正式发布时间：预计 2025 年底 基于：Spring Framework 7.0 最低要求：Java 17（推荐 Java 21/25） 为什么要升级到 Spring Boo'
---

# Spring Boot 4.0 全面升级指南：拥抱现代化 Java 企业开发

> **当前版本：4.0.0-RC2（候选发布版）**  
> **正式发布时间：预计 2025 年底**  
> **基于：Spring Framework 7.0**  
> **最低要求：Java 17（推荐 Java 21/25）**

## 为什么要升级到 Spring Boot 4？

Spring Boot 4 是继 3.0（2022年）之后的又一个重大版本升级，带来了以下核心价值：

### 📊 技术价值

- **模块化架构**：更精细的依赖管理，减少不必要的依赖
- **性能提升**：构建速度提升 20-30%，GraalVM 原生镜像支持更完善
- **现代化基础**：全面拥抱 Jakarta EE 11，支持最新 Java 特性（虚拟线程等）
- **增强的可观测性**：Micrometer 2.0+ 和 OpenTelemetry 深度集成

### 💡 开发体验

- **API 版本控制**：内置 API 版本管理，告别手动路由处理
- **弹性方法**：`@Retryable` 和 `@ConcurrencyLimit` 开箱即用
- **空安全性**：JSpecify 注解，Kotlin 开发更友好
- **简化配置**：Record 类型配置属性，代码更简洁

---

## Spring Boot 4 核心变化

### 1. 技术栈升级

| 组件 | Spring Boot 3.x | Spring Boot 4.0 | 说明 |
| --- | --- | --- | --- |
| **Java** | 17+ | 17+（推荐 21/25） | 支持虚拟线程、记录类等新特性 |
| **Spring Framework** | 6.x | 7.0 | 全新架构和 API |
| **Jakarta EE** | 9/10 | 11 | Servlet 6.1, JPA 3.2 |
| **Hibernate** | 6.1+ | 7.0 | 性能和 API 改进 |
| **Micrometer** | 1.x | 2.0+ | 更强的可观测性 |
| **Kotlin** | 1.7+ | 2.2+ | 更好的协程支持 |

### 2. 包结构变化

```
// Spring Boot 3.x
import org.springframework.boot.autoconfigure.*;

// Spring Boot 4.0 - 模块化包结构
import org.springframework.boot.autoconfigure.web.servlet.WebMvcAutoConfiguration;
import org.springframework.boot.data.jpa.JpaAutoConfiguration;
import org.springframework.boot.security.SecurityAutoConfiguration;
```

每个技术栈现在都有独立的模块，包路径更加清晰。

### 3. 移除的功能

#### ❌ 不再支持

- **Undertow**：由于 Servlet 6.1 兼容性问题暂时移除
- *javax. 包*\*：全部替换为 jakarta.\*
- **JUnit 4**：必须使用 JUnit 5
- **Jackson 2.x**：升级到 Jackson 3.x

#### ⚠️ 已弃用

- **Classic Starters**：保留但建议迁移到模块化 starters
- **某些 MVC 路径匹配选项**：如 `suffixPatternMatch`、`trailingSlashMatch`

---

## 从 Spring Boot 3 升级的关键点

### 1. 依赖升级

#### Maven 配置变化

```
<!-- Spring Boot 3.x -->
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.3.5</version>
</parent>

<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
</dependencies>
```

```
<!-- Spring Boot 4.0 -->
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>4.0.0-RC2</version>
</parent>

<dependencies>
    <!-- 新的模块化 starter -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    
    <!-- 如果使用经典 starter（过渡期） -->
    <!-- 
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web-classic</artifactId>
    </dependency>
    -->
</dependencies>
```

#### Gradle 配置变化

```
// Spring Boot 3.x
plugins {
    id 'org.springframework.boot' version '3.3.5'
}

// Spring Boot 4.0
plugins {
    id 'org.springframework.boot' version '4.0.0-RC2'
}
```

### 2. 包导入更新

#### 自动迁移工具

```
<!-- 添加属性迁移器 -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-properties-migrator</artifactId>
    <scope>runtime</scope>
</dependency>
```

这个工具会在运行时：

- 检测过时的配置属性
- 提供迁移建议
- 临时适配旧配置（开发阶段）

---

## 新特性详解与代码示例

### 🎯 特性 1：内置 API 版本控制

**Spring Boot 3.x 的痛点**：

```
// 需要手动管理不同版本的路径
@RestController
@RequestMapping("/api/v1/users")
public class UserControllerV1 {
    @GetMapping("/{id}")
    public UserV1 getUser(@PathVariable Long id) {
        return userService.getUserV1(id);
    }
}

@RestController
@RequestMapping("/api/v2/users")
public class UserControllerV2 {
    @GetMapping("/{id}")
    public UserV2 getUser(@PathVariable Long id) {
        return userService.getUserV2(id);
    }
}
```

**✅ Spring Boot 4.0 解决方案**：

```
@RestController
@RequestMapping("/api/users")
public class UserController {
    
    // 版本 1 的 API
    @GetMapping(value = "/{id}", version = "1")
    public UserV1 getUserV1(@PathVariable Long id) {
        return userService.getUserV1(id);
    }
    
    // 版本 2 的 API
    @GetMapping(value = "/{id}", version = "2")
    public UserV2 getUserV2(@PathVariable Long id) {
        return userService.getUserV2(id);
    }
    
    // 默认使用最新版本（如果不指定版本号）
    @GetMapping("/{id}")
    public UserV2 getUser(@PathVariable Long id) {
        return getUserV2(id);
    }
}
```

**客户端调用**：

```
# 调用 V1 API
curl -H "Accept-Version: 1" http://localhost:8080/api/users/123

# 调用 V2 API
curl -H "Accept-Version: 2" http://localhost:8080/api/users/123

# 不指定版本，使用默认版本
curl http://localhost:8080/api/users/123
```

**配置自定义版本策略**：

```
@Configuration
public class ApiVersionConfig implements WebMvcConfigurer {
    
    @Override
    public void configureContentNegotiation(ContentNegotiationConfigurer configurer) {
        configurer
            .favorParameter(true)
            .parameterName("api-version")
            .defaultContentType(MediaType.APPLICATION_JSON);
    }
}
```

现在可以通过 URL 参数指定版本：

```
http://localhost:8080/api/users/123?api-version=1
```

---

### 🎯 特性 2：弹性方法（Resilience Methods）

Spring Boot 4 内置了类似 Resilience4j 的功能，无需额外依赖。

#### @Retryable - 自动重试

**Spring Boot 3.x**：

```
// 需要引入 spring-retry 或 Resilience4j
@Service
public class PaymentService {
    
    @Retryable(maxAttempts = 3, backoff = @Backoff(delay = 1000))
    public PaymentResult processPayment(PaymentRequest request) {
        // 可能失败的支付逻辑
        return externalPaymentGateway.charge(request);
    }
}
```

**✅ Spring Boot 4.0**：

```
@Service
@EnableResilientMethods  // 启用弹性方法
public class PaymentService {
    
    // 基础重试：最多重试 3 次
    @Retryable(maxAttempts = 3)
    public PaymentResult processPayment(PaymentRequest request) {
        return externalPaymentGateway.charge(request);
    }
    
    // 高级重试：指数退避 + 抖动
    @Retryable(
        maxAttempts = 5,
        backoff = @Backoff(
            delay = 1000,      // 初始延迟 1 秒
            multiplier = 2,    // 每次翻倍
            maxDelay = 10000,  // 最大延迟 10 秒
            jitter = 0.5       // 50% 随机抖动
        ),
        include = {IOException.class, TimeoutException.class},
        exclude = {IllegalArgumentException.class}
    )
    public DataResponse fetchDataFromRemote(String url) {
        return httpClient.get(url);
    }
    
    // 支持响应式类型
    @Retryable(maxAttempts = 3)
    public Mono<OrderResult> createOrderReactive(Order order) {
        return orderRepository.save(order);
    }
}
```

**重试日志和监控**：

```
# application.yml
spring:
  resilience:
    retry:
      enabled: true
      metrics-enabled: true  # 开启指标收集
      logging-level: DEBUG   # 记录重试日志
```

#### @ConcurrencyLimit - 并发限制

```
@Service
@EnableResilientMethods
public class ReportService {
    
    // 限制最多 5 个并发请求
    @ConcurrencyLimit(maxConcurrentCalls = 5)
    public Report generateHeavyReport(ReportParams params) {
        // 耗时的报表生成逻辑
        return reportGenerator.generate(params);
    }
    
    // 限制为单线程执行（适合资源敏感操作）
    @ConcurrencyLimit(maxConcurrentCalls = 1)
    public void updateCriticalBalance(Account account, BigDecimal amount) {
        // 必须串行执行的余额更新
        account.setBalance(account.getBalance().add(amount));
        accountRepository.save(account);
    }
    
    // 超时拒绝策略
    @ConcurrencyLimit(
        maxConcurrentCalls = 10,
        timeout = 5000,  // 等待 5 秒后拒绝
        fallback = "generateReportFallback"
    )
    public Report generateReport(ReportParams params) {
        return reportGenerator.generate(params);
    }
    
    // Fallback 方法
    private Report generateReportFallback(ReportParams params, Throwable t) {
        log.warn("Report generation failed, returning cached version", t);
        return cachedReportService.getLastReport(params);
    }
}
```

---

### 🎯 特性 3：Record 类型配置属性

**Spring Boot 3.x**：

```
@Component
@ConfigurationProperties(prefix = "app.database")
public class DatabaseProperties {
    private String url;
    private String username;
    private String password;
    private int poolSize = 10;
    
    // Getters and Setters
    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }
    // ... 重复的样板代码
}
```

**✅ Spring Boot 4.0 - 使用 Record**：

```
@ConfigurationProperties("app.database")
public record DatabaseProperties(
    String url,
    String username,
    String password,
    @DefaultValue("10") int poolSize,
    @DefaultValue("true") boolean sslEnabled
) {
    // 可以添加自定义验证
    public DatabaseProperties {
        if (poolSize < 1 || poolSize > 100) {
            throw new IllegalArgumentException("Pool size must be between 1 and 100");
        }
    }
}
```

**配置文件**：

```
# application.yml
app:
  database:
    url: jdbc:postgresql://localhost:5432/mydb
    username: admin
    password: secret
    pool-size: 20
    ssl-enabled: true
```

**使用配置**：

```
@Service
@RequiredArgsConstructor
public class DataSourceService {
    private final DatabaseProperties dbProperties;
    
    public DataSource createDataSource() {
        return DataSourceBuilder.create()
            .url(dbProperties.url())
            .username(dbProperties.username())
            .password(dbProperties.password())
            .build();
    }
}
```

**嵌套 Record 配置**：

```
@ConfigurationProperties("app")
public record ApplicationProperties(
    DatabaseConfig database,
    CacheConfig cache,
    SecurityConfig security
) {
    public record DatabaseConfig(String url, int poolSize) {}
    public record CacheConfig(String provider, int ttl) {}
    public record SecurityConfig(boolean enabled, String jwtSecret) {}
}
```

---

### 🎯 特性 4：改进的 SpEL 支持

**Spring Boot 4.0 增强了 SpEL（Spring Expression Language）对 Optional 的支持**。

```
@Component
public class UserProfileService {
    
    @Autowired
    private UserService userService;
    
    // Elvis 操作符处理 Optional
    @Value("#{userService.findUserById(#userId)?.orElse('Guest')}")
    private String currentUser;
    
    // 安全的链式调用
    @Value("#{userService.getCurrentUser()?.getAddress()?.getCity() ?: 'Unknown'}")
    private String userCity;
    
    // 在配置类中使用
    @Bean
    @ConditionalOnExpression("#{userService.getCurrentUser()?.isAdmin() ?: false}")
    public AdminDashboard adminDashboard() {
        return new AdminDashboard();
    }
}
```

**SpEL 在方法上的应用**：

```
@Service
public class NotificationService {
    
    // 使用 SpEL 计算重试延迟
    @Retryable(
        maxAttempts = 5,
        backoffExpression = "#{@retryConfig.calculateBackoff(#attempt)}"
    )
    public void sendNotification(Notification notification) {
        emailService.send(notification);
    }
}
```

---

### 🎯 特性 5：JMS Client API 支持

**Spring Boot 3.x**：

```
@Service
public class OrderProcessingService {
    
    @Autowired
    private JmsTemplate jmsTemplate;
    
    public void processOrder(Order order) {
        // 使用 JmsTemplate
        jmsTemplate.convertAndSend("order.queue", order);
    }
    
    public Order receiveOrder() {
        return (Order) jmsTemplate.receiveAndConvert("order.queue");
    }
}
```

**✅ Spring Boot 4.0 - 新 JmsClient API**：

```
@Service
public class OrderProcessingService {
    
    @Autowired
    private JmsClient jmsClient;  // 新的 API
    
    // 发送消息（更简洁）
    public void processOrder(Order order) {
        jmsClient.send("order.queue")
                 .payload(order)
                 .send();
    }
    
    // 带属性发送
    public void processUrgentOrder(Order order) {
        jmsClient.send("order.queue")
                 .payload(order)
                 .property("priority", 9)
                 .property("type", "URGENT")
                 .send();
    }
    
    // 接收消息（类型安全）
    public Optional<Order> receiveOrder() {
        return jmsClient.receive("order.queue")
                       .as(Order.class);
    }
    
    // 带超时的接收
    public Optional<Order> receiveOrderWithTimeout() {
        return jmsClient.receive("order.queue")
                       .timeout(Duration.ofSeconds(5))
                       .as(Order.class);
    }
    
    // 消费消息（流式 API）
    public void consumeOrders() {
        jmsClient.consume("order.queue")
                 .as(Order.class)
                 .forEach(order -> {
                     log.info("Processing order: {}", order);
                     processOrder(order);
                 });
    }
}
```

**自动配置**：

```
# application.yml
spring:
  jms:
    client:
      enabled: true
      pub-sub-domain: false  # 使用队列模式
```

---

### 🎯 特性 6：改进的 SSL 健康检查

**Spring Boot 4.0 改进了 SSL 证书监控**。

```
// 健康检查端点会返回更详细的信息
{
  "status": "UP",
  "components": {
    "ssl": {
      "status": "UP",
      "details": {
        "validChains": [
          {
            "alias": "main-cert",
            "validFrom": "2024-01-01T00:00:00Z",
            "validUntil": "2025-12-31T23:59:59Z"
          }
        ],
        "expiringChains": [
          {
            "alias": "backup-cert",
            "validFrom": "2024-01-01T00:00:00Z",
            "validUntil": "2025-01-15T23:59:59Z",
            "daysUntilExpiry": 30
          }
        ]
      }
    }
  }
}
```

**配置**：

```
management:
  health:
    ssl:
      enabled: true
      # 证书即将过期的警告阈值
      certificate-validity-warning-threshold: 30d
  endpoint:
    health:
      show-details: always
```

**自定义 SSL 健康检查**：

```
@Component
public class CustomSslHealthIndicator implements HealthIndicator {
    
    @Override
    public Health health() {
        try {
            // 检查所有 SSL 证书
            List<CertificateInfo> certs = sslService.getAllCertificates();
            
            long expiringSoon = certs.stream()
                .filter(cert -> cert.daysUntilExpiry() < 30)
                .count();
            
            if (expiringSoon > 0) {
                return Health.up()
                    .withDetail("warning", expiringSoon + " certificates expiring soon")
                    .build();
            }
            
            return Health.up()
                .withDetail("totalCertificates", certs.size())
                .build();
                
        } catch (Exception e) {
            return Health.down()
                .withException(e)
                .build();
        }
    }
}
```

---

### 🎯 特性 7：模块化 Auto-Configuration

**Spring Boot 4.0 最大的架构变化：模块化**。

#### 新的包结构

```
Spring Boot 3.x:
org.springframework.boot.autoconfigure
  ├── jdbc
  ├── orm.jpa
  ├── web
  └── ...

Spring Boot 4.0:
org.springframework.boot.autoconfigure.web.servlet  (单独模块)
org.springframework.boot.data.jpa                   (单独模块)
org.springframework.boot.security                   (单独模块)
org.springframework.boot.actuator.metrics          (单独模块)
```

#### 依赖管理变化

**Spring Boot 3.x**：

```
<!-- 一个大而全的依赖 -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-autoconfigure</artifactId>
</dependency>
```

**Spring Boot 4.0**：

```
<!-- 只引入需要的模块 -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-autoconfigure-web-servlet</artifactId>
</dependency>

<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-autoconfigure-data-jpa</artifactId>
</dependency>
```

#### @ConfigurationPropertiesSource 注解

用于跨模块读取配置属性。

```
// 在共享模块中定义
@ConfigurationProperties("shared.api")
@ConfigurationPropertiesSource  // 新注解
public record ApiProperties(
    String baseUrl,
    int timeout,
    int maxRetries
) {}
```

```
// 在应用模块中使用
@SpringBootApplication
@EnableConfigurationProperties(ApiProperties.class)
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

---

### 🎯 特性 8：增强的测试支持

**暂停未使用的应用上下文**：

```
@SpringBootTest
class OrderServiceTest {
    
    @Autowired
    private OrderService orderService;
    
    @Test
    void testCreateOrder() {
        // Spring Boot 4.0 会自动暂停其他测试类的上下文
        // 减少内存占用，加速测试执行
        Order order = orderService.createOrder(new OrderRequest());
        assertThat(order).isNotNull();
    }
}
```

**Testcontainers 集成改进**：

```
@SpringBootTest
@Testcontainers
class DatabaseIntegrationTest {
    
    @Container
    @ServiceConnection  // Spring Boot 4.0 自动配置连接
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15");
    
    // 支持 MongoDB Atlas Local Container
    @Container
    @ServiceConnection
    static MongoDBAtlasLocalContainer mongodb = new MongoDBAtlasLocalContainer();
    
    @Test
    void testDatabaseOperations() {
        // 自动连接到容器，无需手动配置
    }
}
```

---

### 🎯 特性 9：Micrometer 2.0+ 和可观测性

**更强大的指标收集**：

```
@Service
public class OrderService {
    
    @Autowired
    private MeterRegistry meterRegistry;
    
    // 使用 @MeterTag 进行动态标签
    @Timed(value = "order.processing", extraTags = {"service", "order"})
    @Counted(value = "order.created")
    public Order createOrder(@MeterTag("type") String orderType, OrderRequest request) {
        // SpEL 支持的标签值解析
        Counter.builder("order.value")
            .tag("type", orderType)
            .tag("region", request.getRegion())
            .register(meterRegistry)
            .increment(request.getAmount().doubleValue());
        
        return processOrder(request);
    }
}
```

**OpenTelemetry 集成**：

```
# application.yml
management:
  metrics:
    export:
      otlp:
        enabled: true
        endpoint: http://localhost:4318/v1/metrics
  tracing:
    enabled: true
    sampling:
      probability: 1.0
```

```
@Configuration
public class ObservabilityConfig {
    
    @Bean
    public ObservationHandler<Observation.Context> loggingHandler() {
        return new ObservationTextPublisher();
    }
    
    @Bean
    public TracingObservationHandler tracingHandler() {
        return new TracingObservationHandler();
    }
}
```

---

### 🎯 特性 10：Kotlin 2.2+ 支持

**更好的协程支持**：

```
@RestController
@RequestMapping("/api/products")
class ProductController(
    private val productService: ProductService
) {
    
    // 协程支持
    @GetMapping("/{id}")
    suspend fun getProduct(@PathVariable id: Long): Product {
        return productService.findById(id)
    }
    
    // Flow 支持
    @GetMapping
    fun getAllProducts(): Flow<Product> {
        return productService.findAll()
    }
    
    // 使用 Spring Boot 4.0 的 API 版本控制
    @GetMapping(value = "/search", version = "1")
    suspend fun searchProductsV1(@RequestParam query: String): List<ProductV1> {
        return productService.searchV1(query)
    }
    
    @GetMapping(value = "/search", version = "2")
    suspend fun searchProductsV2(@RequestParam query: String): List<ProductV2> {
        return productService.searchV2(query)
    }
}
```

**配置类使用 Record**：

```
@ConfigurationProperties("app")
data class AppProperties(
    val database: DatabaseConfig,
    val cache: CacheConfig
) {
    data class DatabaseConfig(val url: String, val poolSize: Int)
    data class CacheConfig(val ttl: Duration, val maxSize: Int)
}
```

---

## 配置变化与迁移

### 1. application.yml 配置更新

**已移除的配置**：

```
# ❌ Spring Boot 3.x
spring:
  mvc:
    pathmatch:
      suffix-pattern-match: true      # 已移除
      trailing-slash-match: true      # 已移除
      use-registered-suffix-pattern: true  # 已移除
```

**新增的配置**：

```
# ✅ Spring Boot 4.0
spring:
  # API 版本控制配置
  mvc:
    version:
      enabled: true
      header-name: Accept-Version
      parameter-name: api-version
  
  # 弹性方法配置
  resilience:
    retry:
      enabled: true
      metrics-enabled: true
    concurrency-limit:
      enabled: true
  
  # JMS Client 配置
  jms:
    client:
      enabled: true
      pub-sub-domain: false
  
  # 模块化配置
  autoconfigure:
    exclude:
      - org.springframework.boot.autoconfigure.web.servlet.error.ErrorMvcAutoConfiguration
```

### 2. Actuator 端点变化

```
management:
  endpoints:
    web:
      exposure:
        include: "*"
  endpoint:
    health:
      show-details: always
      probes:
        enabled: true
    # 新的 SSL 健康检查
    ssl:
      enabled: true
```

---

## 实战迁移步骤

### 步骤 1：环境准备

```
# 1. 升级 Java（推荐 21 或 25）
java --version  # 确保 >= 17

# 2. 升级构建工具
mvn --version   # Maven 3.8+
gradle --version # Gradle 8.0+

# 3. 备份项目
git checkout -b upgrade/spring-boot-4
```

### 步骤 2：更新依赖

```
<!-- pom.xml -->
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>4.0.0-RC2</version>
</parent>

<dependencies>
    <!-- 添加迁移工具 -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-properties-migrator</artifactId>
        <scope>runtime</scope>
    </dependency>
</dependencies>
```

### 步骤 3：修复编译错误

```
// 1. 更新包导入
// ❌ 旧代码
import javax.annotation.PostConstruct;
import javax.persistence.Entity;

// ✅ 新代码
import jakarta.annotation.PostConstruct;
import jakarta.persistence.Entity;

// 2. 更新配置类包路径
// ❌ 旧代码
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;

// ✅ 新代码
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
// 注意：大部分情况下路径保持不变，但内部实现已模块化
```

### 步骤 4：更新配置文件

```
# 运行应用，查看迁移器输出
mvn spring-boot:run

# 输出示例：
# [WARN] Property 'spring.mvc.pathmatch.suffix-pattern-match' is deprecated.
#        Reason: This feature has been removed.
#        Replacement: Use content negotiation via 'Accept' header instead.
```

### 步骤 5：测试验证

```
@SpringBootTest
class ApplicationTests {
    
    @Test
    void contextLoads() {
        // 确保应用上下文正常启动
    }
    
    @Test
    void testApiVersioning() {
        // 测试新的 API 版本控制功能
    }
}
```

### 步骤 6：渐进式采用新特性

```
// 阶段 1：基本迁移（保持功能不变）
// - 只更新依赖和包导入
// - 确保现有功能正常工作

// 阶段 2：采用新 API（提升体验）
@Service
@EnableResilientMethods  // 使用弹性方法
public class OrderService {
    
    @Retryable(maxAttempts = 3)
    public Order createOrder(OrderRequest request) {
        return orderRepository.save(order);
    }
}

// 阶段 3：优化架构（长期收益）
// - 使用 Record 配置类
// - 采用 API 版本控制
// - 利用模块化减少依赖
```

---

## 常见问题与解决方案

### Q1: Undertow 支持何时恢复？

**问题**：Spring Boot 4.0 暂时移除了 Undertow 支持。

**解决方案**：

```
<!-- 使用 Tomcat（默认） -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
</dependency>

<!-- 或使用 Jetty -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
    <exclusions>
        <exclusion>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-tomcat</artifactId>
        </exclusion>
    </exclusions>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-jetty</artifactId>
</dependency>
```

**注意**：Undertow 团队正在适配 Servlet 6.1，预计后续版本会恢复支持。

---

### Q2: 如何处理 JSpecify 空安全性警告？

**问题**：Spring Boot 4.0 添加了 JSpecify 注解，Kotlin 和空值检查工具可能报错。

**解决方案**：

```
// Spring Boot 4.0 的 API 现在明确标注空安全性
import org.jspecify.annotations.Nullable;
import org.jspecify.annotations.NonNull;

@Service
public class UserService {
    
    // 明确返回值可能为 null
    public @Nullable User findUserById(Long id) {
        return userRepository.findById(id).orElse(null);
    }
    
    // 明确参数不能为 null
    public User createUser(@NonNull UserRequest request) {
        Objects.requireNonNull(request, "Request cannot be null");
        return userRepository.save(new User(request));
    }
}
```

**Kotlin 中的处理**：

```
@Service
class UserService(
    private val userRepository: UserRepository
) {
    // Spring 的空安全性注解会被 Kotlin 识别
    fun findUserById(id: Long): User? {
        return userRepository.findById(id).orElse(null)
    }
    
    fun createUser(request: UserRequest): User {
        // Kotlin 自动处理非空约束
        return userRepository.save(User(request))
    }
}
```

---

### Q3: Classic Starters 何时废弃？

**问题**：Spring Boot 4.0 保留了 Classic Starters 作为过渡，但标记为弃用。

**当前状态**：

```
<!-- 仍可使用（但会有警告） -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web-classic</artifactId>
</dependency>
```

**迁移建议**：

```
<!-- 推荐使用新的模块化 starter -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
</dependency>
```

大部分项目使用 starter 依赖的话，无需改动，Spring Boot 会自动处理模块依赖。

---

### Q4: 如何支持 Spring Boot 3 和 4 双版本？

**问题**：库维护者希望同时支持两个版本。

**官方建议**：不推荐在同一 artifact 中同时支持。

**推荐方案**：

```
<!-- 方案 1：分支策略 -->
<!-- 维护两个分支 -->
main (Spring Boot 4.x)
├── support/3.x (Spring Boot 3.x)

<!-- 方案 2：多模块项目 -->
<modules>
    <module>mylib-spring-boot-3</module>
    <module>mylib-spring-boot-4</module>
    <module>mylib-core</module>  <!-- 共享代码 -->
</modules>
```

---

### Q5: GraalVM 原生镜像构建变化？

**Spring Boot 3.x**：

```
mvn -Pnative spring-boot:build-image
```

**Spring Boot 4.0 改进**：

```
# 构建速度提升 20-30%
mvn -Pnative spring-boot:build-image

# 更精确的元数据提示
# 模块化架构减少了 AOT 处理时间
```

**配置优化**：

```
<plugin>
    <groupId>org.graalvm.buildtools</groupId>
    <artifactId>native-maven-plugin</artifactId>
    <configuration>
        <buildArgs>
            <buildArg>--initialize-at-build-time=org.slf4j</buildArg>
            <!-- Spring Boot 4.0 的模块化使得原生镜像提示更准确 -->
        </buildArgs>
    </configuration>
</plugin>
```

---

## 总结与建议

### 🎯 升级价值总结

| 维度 | Spring Boot 3.x | Spring Boot 4.0 | 提升 |
| --- | --- | --- | --- |
| **构建速度** | 基线 | 模块化优化 | ⬆️ 20-30% |
| **原生镜像** | 支持 | 更快、更精确 | ⬆️ 20-30% |
| **代码简洁度** | 良好 | Record 配置、API 版本控制 | ⬆️ 30-40% |
| **弹性能力** | 需第三方库 | 内置 @Retryable/@ConcurrencyLimit | ⬆️ 显著提升 |
| **可观测性** | Micrometer 1.x | Micrometer 2.0+ | ⬆️ 增强 |
| **测试性能** | 良好 | 上下文暂停优化 | ⬆️ 20-40% |

### 📋 升级检查清单

#### ✅ 升级前准备

- [ ] 确认 Java 版本 >= 17（推荐 21/25）
- [ ] 审查依赖兼容性（特别是第三方库）
- [ ] 备份项目代码
- [ ] 准备回滚方案
- [ ] 阅读官方迁移指南

#### ✅ 升级过程

- [ ] 更新 Spring Boot 版本到 4.0.0-RC2
- [ ] 添加 `spring-boot-properties-migrator` 依赖
- [ ] 修复 `javax.*` → `jakarta.*` 包导入
- [ ] 更新测试框架（JUnit 4 → JUnit 5）
- [ ] 验证配置文件（删除已废弃的属性）
- [ ] 运行完整测试套件

#### ✅ 升级后优化

- [ ] 移除 `spring-boot-properties-migrator`
- [ ] 采用 Record 类型配置属性
- [ ] 使用 `@Retryable` 和 `@ConcurrencyLimit`
- [ ] 实施 API 版本控制
- [ ] 优化模块依赖（如果不使用 starter）
- [ ] 监控性能指标

### 🚀 推荐升级策略

#### 策略 1：保守升级（大型企业）

```
阶段 1（1-2 周）：环境搭建和试点项目
  └── 选择 1-2 个小型服务进行升级测试

阶段 2（2-4 周）：基础迁移
  └── 只做必要的依赖和包更新，保持功能不变

阶段 3（1-3 个月）：新特性采用
  └── 逐步采用弹性方法、API 版本控制等新特性

阶段 4（持续）：架构优化
  └── 利用模块化、Record 配置等优化代码
```

#### 策略 2：激进升级（初创/小团队）

```
快速迁移（1-2 周）：
  1. 一次性更新所有依赖
  2. 批量修复编译错误
  3. 立即采用新特性（Record、弹性方法等）
  4. 快速迭代测试
```

#### 策略 3：混合升级（中型团队）

```
并行开发（2-4 周）：
  1. 新功能使用 Spring Boot 4.0
  2. 现有服务逐步升级
  3. 关键服务优先升级
  4. 非关键服务延后
```

### 💡 最佳实践建议

1. **优先使用 Starter 依赖**

   - 让 Spring Boot 自动管理模块化依赖
   - 避免手动管理细粒度模块
2. **及早采用新配置方式**

   - Record 配置属性（代码更简洁）
   - 弹性方法（减少样板代码）
3. **关注性能监控**

   - 利用 Micrometer 2.0+ 的新功能
   - 配置 OpenTelemetry 分布式追踪
4. **测试覆盖要全面**

   - 升级后务必进行充分测试
   - 特别关注集成测试和端到端测试
5. **保持文档更新**

   - 记录升级过程中的问题和解决方案
   - 为团队提供清晰的迁移指南

---

## 参考资源

- [Spring Boot 4.0 官方文档](https://docs.spring.io/spring-boot/docs/current/reference/html/)
- [Spring Boot 4.0 迁移指南](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Migration-Guide)
- [Spring Framework 7.0 发布说明](https://github.com/spring-projects/spring-framework/wiki/What's-New-in-Spring-Framework-7.x)
- [Spring Boot 4.0 Release Notes](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Release-Notes)
- [Modularizing Spring Boot](https://spring.io/blog/2025/10/28/modularizing-spring-boot)

---

**结语**：Spring Boot 4.0 是一次深思熟虑的升级，在保持向后兼容性的同时，引入了现代化的特性和架构改进。虽然升级需要一定的工作量，但长期来看，模块化架构、内置弹性能力、改进的可观测性等特性将显著提升开发效率和应用质量。建议团队根据自身情况制定合理的升级计划，逐步拥抱 Spring Boot 4 带来的新能力。

**祝升级顺利！🚀**
