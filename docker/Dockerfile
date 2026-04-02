FROM python:3.10-slim

WORKDIR /opt/install_tracker

# Install OS-level deps for psycopg2
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ app/

# Streamlit config
RUN mkdir -p /root/.streamlit
RUN echo '\
[server]\n\
port = 8503\n\
headless = true\n\
enableCORS = false\n\
enableXsrfProtection = false\n\
\n\
[theme]\n\
primaryColor = "#4f8bf9"\n\
backgroundColor = "#0e1117"\n\
secondaryBackgroundColor = "#262730"\n\
textColor = "#fafafa"\n\
' > /root/.streamlit/config.toml

ENV PYTHONPATH="/opt/install_tracker"

EXPOSE 8503

CMD ["streamlit", "run", "app/main.py", "--server.port=8503"]
