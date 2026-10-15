# Build from the repo root (docker build -f apps/api/Dockerfile .): the build
# copies the seed and AI corpora from packages/shared/fixtures, so the same
# layout is kept under /repo. .dockerignore at the root keeps the rest out.
FROM eclipse-temurin:25-jdk AS build
WORKDIR /repo/apps/api
COPY apps/api/gradlew apps/api/settings.gradle.kts apps/api/build.gradle.kts ./
COPY apps/api/gradle gradle
RUN ./gradlew --no-daemon dependencies > /dev/null
COPY packages/shared/fixtures /repo/packages/shared/fixtures
COPY apps/api/src src
RUN ./gradlew --no-daemon bootJar -x test

# Runtime stage: JRE only, non-root.
FROM eclipse-temurin:25-jre
WORKDIR /app
RUN useradd --system --uid 1001 app
COPY --from=build /repo/apps/api/build/libs/*.jar app.jar
USER app
# Tuned for Render's free 512 MB instance: bounded heap and metaspace,
# the serial GC (lowest overhead on 1 CPU) and smaller thread stacks.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70 -XX:MaxMetaspaceSize=128m -XX:+UseSerialGC -Xss512k -XX:TieredStopAtLevel=1"
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
