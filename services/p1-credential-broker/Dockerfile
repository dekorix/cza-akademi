FROM node:22.22.0-alpine3.23
WORKDIR /srv/cza
COPY services/p1-credential-broker services/p1-credential-broker
COPY security/faz3/oidc/p1-neon-runtime-policy.json security/faz3/oidc/p1-neon-runtime-policy.json
COPY security/faz3/oidc/p1-neon-runtime-trust.mjs security/faz3/oidc/p1-neon-runtime-trust.mjs
RUN mkdir -p /var/lib/cza-p1-broker && chown node:node /var/lib/cza-p1-broker
USER node
EXPOSE 8080
CMD ["node", "services/p1-credential-broker/server.mjs"]
