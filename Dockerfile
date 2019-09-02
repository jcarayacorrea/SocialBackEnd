FROM node:latest
WORKDIR /backFirebase
RUN npm i -g firebase-tools
RUN apt update
RUN apt install --yes default-jre
ENV GOOGLE_APPLICATION_CREDENTIALS /backFirebase/socialMediaDemo-5b59b279ae6a.json
ADD config.json /root/.config/configstore/@google-cloud/functions-emulator/config.json
EXPOSE 8080 5001 5000 9005