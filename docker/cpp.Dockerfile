FROM gcc:13-bookworm

RUN groupadd -r sandbox && useradd -r -g sandbox sandbox

WORKDIR /code
RUN chown sandbox:sandbox /code

USER sandbox

CMD ["g++"]
