# Build stage: compile and package the boot jar.
FROM eclipse-temurin:25-jdk AS build
WORKDIR /src
COPY gradlew settings.gradle.kts build.gradle.kts ./
COPY gradle gradle
RUN ./gradlew --no-daemon dependencies > /dev/null
COPY src src
RUN ./gradlew --no-daemon bootJar -x test

# Runtime stage: JRE only, non-root.
FROM eclipse-temurin:25-jre
WORKDIR /app
RUN useradd --system --uid 1001 app
COPY --from=build /src/build/libs/*.jar app.jar
USER app
# Tuned for Render's free 512 MB instance: bounded heap and metaspace,
# the serial GC (lowest overhead on 1 CPU) and smaller thread stacks.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70 -XX:MaxMetaspaceSize=128m -XX:+UseSerialGC -Xss512k -XX:TieredStopAtLevel=1"
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
