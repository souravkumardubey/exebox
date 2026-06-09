FROM node:20-alpine

RUN addgroup -S sandbox && adduser -S sandbox -G sandbox

WORKDIR /code
RUN chown sandbox:sandbox /code

USER sandbox

CMD ["node"]
