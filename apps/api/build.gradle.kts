plugins {
	java
	id("org.springframework.boot") version "4.1.1"
	id("io.spring.dependency-management") version "1.1.7"
	id("com.diffplug.spotless") version "8.10.4"
}

group = "app.nemmail"
version = "0.1.0"

java {
	toolchain {
		languageVersion = JavaLanguageVersion.of(25)
	}
}

repositories {
	mavenCentral()
}

dependencies {
	implementation("org.springframework.boot:spring-boot-starter-actuator")
	implementation("org.springframework.boot:spring-boot-starter-data-jpa")
	implementation("org.springframework.boot:spring-boot-starter-flyway")
	implementation("org.springframework.boot:spring-boot-starter-mail")
	implementation("org.springframework.boot:spring-boot-starter-security")
	implementation("org.springframework.boot:spring-boot-starter-validation")
	implementation("org.springframework.boot:spring-boot-starter-webmvc")
	implementation("com.bucket4j:bucket4j_jdk17-core:8.20.0")
	implementation("com.github.ben-manes.caffeine:caffeine")
	implementation("org.bouncycastle:bcprov-jdk18on:1.86")
	implementation("org.flywaydb:flyway-database-postgresql")
	implementation("org.hibernate.orm:hibernate-vector")
	runtimeOnly("org.postgresql:postgresql")
	testImplementation("org.springframework.boot:spring-boot-starter-webmvc-test")
	testImplementation("org.springframework.boot:spring-boot-testcontainers")
	testImplementation("org.testcontainers:testcontainers-junit-jupiter")
	testImplementation("org.testcontainers:testcontainers-postgresql")
	testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.withType<JavaCompile> {
	options.compilerArgs.addAll(listOf("-Xlint:all", "-Werror"))
}

tasks.withType<Test> {
	useJUnitPlatform()
	// ./gradlew test -PwriteApiFixtures: ApiContractFixturesTest writes the responses the
	// shared Zod schemas are checked against in Vitest.
	if (project.hasProperty("writeApiFixtures")) {
		systemProperty("nem.apiFixtures", file("../../packages/shared/fixtures/api").absolutePath)
		outputs.upToDateWhen { false }
	}
}

spotless {
	java {
		googleJavaFormat()
	}
}

// The shared demo seed (npm run seed:export -w packages/shared) ships on the classpath.
tasks.processResources {
	from("../../packages/shared/fixtures/seed.json") {
		into("seed")
	}
}

// QueryParserTest runs the search parser cases the TS parser runs too.
tasks.processTestResources {
	from("../../packages/shared/fixtures/search-queries.json") {
		into("shared")
	}
}

// The plain jar is unused; the Dockerfile copies the single boot jar.
tasks.named<Jar>("jar") {
	enabled = false
}
