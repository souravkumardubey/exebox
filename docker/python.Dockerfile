FROM python:3.12-slim-bookworm

RUN groupadd -r sandbox && useradd -r -g sandbox sandbox

WORKDIR /code
RUN chown sandbox:sandbox /code

USER sandbox

CMD ["python3"]
