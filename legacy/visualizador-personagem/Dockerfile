FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html styles.css ritual.css app.js ritual-engine.js ritual-builder.js ritual-combinations.json ritual-combinations.example.json /usr/share/nginx/html/
EXPOSE 80
