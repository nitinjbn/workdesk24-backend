Command to create docker image:
docker build -t workdesk24-api .

Command to run docker image:
docker run -p 3000:3000 --env-file .env workdesk24-api