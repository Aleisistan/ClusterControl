#!/bin/sh
set -eu

: "${API_URL:=/api}"
: "${SOCKET_URL:=}"
export API_URL SOCKET_URL

envsubst '${API_URL} ${SOCKET_URL}' \
    < /etc/clustercontrol/runtime-config.json.template \
    > /usr/share/nginx/html/runtime-config.json
