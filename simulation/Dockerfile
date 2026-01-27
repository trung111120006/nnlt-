FROM node:18-alpine

# Install curl for simple requests
RUN apk add --no-cache curl

# We can use a simple CMD to hit the endpoint. 
# Using a shell form to allow variable expansion if needed.
# We sleep a random amount (0-2s) to spread load slightly if desired, or just hit it immediately.
CMD ["sh", "-c", "curl -X POST http://host.docker.internal:3000/api/chat -H 'Content-Type: application/json' -d '{\"prompt\": \"Hello from Docker client\", \"context\": {\"url\": \"/simulation\"}}'"]
#