FROM eclipse-temurin:21-jdk-alpine

RUN addgroup -S sandbox && adduser -S sandbox -G sandbox

WORKDIR /code
RUN chown sandbox:sandbox /code

USER sandbox

CMD ["java"]
