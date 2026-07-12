SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c
MAKEFLAGS += --warn-undefined-variables --no-print-directory

PROJECT_ROOT := $(shell dirname $(realpath $(lastword $(MAKEFILE_LIST))))
NPM := npm
PORT ?= 3001
HERMES_HOME_DIR := $(PROJECT_ROOT)/.hermes
HERMES_ENV_FILE := $(HERMES_HOME_DIR)/.env
APP_ENV_FILE := $(PROJECT_ROOT)/.env
HERMES_DASHBOARD_PORT ?= 9120
HERMES_GATEWAY_PORT ?= 8642
HERMES_GATEWAY_KEY ?= change-me-local-dev
HERMES_DESKTOP_ARGS ?=
HERMES_SKILLS ?=
MLX_VLM_REPO ?= mlx-community/Qwen3.6-27B-OptiQ-4bit
MLX_VLM_MODEL_NAME ?= Qwen3.6-27B-OptiQ-4bit
MLX_VLM_MODEL_DIR ?= $(HOME)/models/qwen/$(MLX_VLM_MODEL_NAME)
MLX_VLM_HERMES_MODEL ?= local-qwen3.6-27b-optiq-4bit
MLX_VLM_VENV ?= $(PROJECT_ROOT)/.venv-mlx
MLX_VLM_HOST ?= 127.0.0.1
MLX_VLM_PORT ?= 8080
MLX_VLM_PROMPT ?= Write a TypeScript debounce function and explain it briefly.
MLX_CHAT_TEMPLATE_ARGS ?= {"enable_thinking": false}

C_GREEN := \033[0;32m
C_YELLOW := \033[0;33m
C_RED := \033[0;31m
C_CYAN := \033[0;36m
C_BOLD := \033[1m
C_RESET := \033[0m

.DEFAULT_GOAL := help

.PHONY: help
help:
	@printf "$(C_BOLD)AppLoop$(C_RESET) — Hermes Next.js visual app builder\n"
	@printf "\n$(C_CYAN)Setup:$(C_RESET)\n"
	@printf "  $(C_GREEN)make install$(C_RESET)       Install npm dependencies\n"
	@printf "\n$(C_CYAN)Development:$(C_RESET)\n"
	@printf "  $(C_GREEN)make dev$(C_RESET)           Start Next.js at http://localhost:$(PORT)\n"
	@printf "  $(C_GREEN)make build$(C_RESET)         Create a production build\n"
	@printf "  $(C_GREEN)make start$(C_RESET)         Start the production server\n"
	@printf "  $(C_GREEN)make lint$(C_RESET)          Run ESLint\n"
	@printf "  $(C_GREEN)make typecheck$(C_RESET)     Run TypeScript checks\n"
	@printf "  $(C_GREEN)make check$(C_RESET)         Run lint and typecheck\n"
	@printf "\n$(C_CYAN)Hermes:$(C_RESET)\n"
	@printf "  $(C_GREEN)make hermes-chat$(C_RESET)               Chat with Hermes for this repo\n"
	@printf "  $(C_GREEN)make hermes-dashboard$(C_RESET)          Dashboard at http://127.0.0.1:$(HERMES_DASHBOARD_PORT)\n"
	@printf "  $(C_GREEN)make hermes-desktop$(C_RESET)            Launch Hermes Desktop with this repo's .hermes/\n"
	@printf "  $(C_GREEN)make hermes-update$(C_RESET)             Sync this repo's .hermes/ config\n"
	@printf "  $(C_GREEN)make hermes-gateway$(C_RESET)            Hermes API server at http://127.0.0.1:$(HERMES_GATEWAY_PORT)\n"
	@printf "  $(C_GREEN)make hermes-gateway-curl-test$(C_RESET)  Test gateway: POST /v1/runs\n"
	@printf "\n$(C_CYAN)MLX-VLM:$(C_RESET)\n"
	@printf "  $(C_GREEN)make mlx-vlm-setup$(C_RESET)             Create .venv-mlx and install MLX-VLM tooling\n"
	@printf "  $(C_GREEN)make mlx-vlm-download$(C_RESET)          Download $(MLX_VLM_REPO) into ~/models/qwen/\n"
	@printf "  $(C_GREEN)make mlx-vlm-check-model$(C_RESET)       Check required local model files\n"
	@printf "  $(C_GREEN)make mlx-vlm-generate$(C_RESET)          Run one local generation with the downloaded model\n"
	@printf "  $(C_GREEN)make mlx-vlm-server$(C_RESET)            OpenAI-compatible MLX server at http://$(MLX_VLM_HOST):$(MLX_VLM_PORT)/v1\n"
	@printf "  $(C_GREEN)make mlx-vlm-curl-test$(C_RESET)         Test the local MLX-VLM server\n"
	@printf "  $(C_GREEN)make hermes-mlx-vlm-config$(C_RESET)     Print Hermes env and YAML config snippets\n"
	@printf "\n$(C_CYAN)Maintenance:$(C_RESET)\n"
	@printf "  $(C_GREEN)make clean$(C_RESET)         Remove generated build output\n"
	@printf "  $(C_GREEN)make reset$(C_RESET)         Remove dependencies and generated output\n"

.PHONY: install
install:
	@cd $(PROJECT_ROOT) && $(NPM) install

.PHONY: dev
dev:
	@if command -v lsof > /dev/null 2>&1 && lsof -tiTCP:$(PORT) -sTCP:LISTEN > /dev/null 2>&1; then \
		LISTENER_PID=$$(lsof -tiTCP:$(PORT) -sTCP:LISTEN | head -n 1); \
		LISTENER_CMD=$$(ps -ww -p $$LISTENER_PID -o command= 2>/dev/null || true); \
		if printf '%s' "$$LISTENER_CMD" | grep -Eq 'next|npm|node'; then \
			printf "$(C_YELLOW)->$(C_RESET) Stopping existing Next.js dev server on port $(PORT) (pid $$LISTENER_PID)...\n"; \
			kill $$LISTENER_PID; \
			for _ in {1..60}; do \
				if ! lsof -tiTCP:$(PORT) -sTCP:LISTEN > /dev/null 2>&1; then break; fi; \
				/bin/sleep 0.5; \
			done; \
			if lsof -tiTCP:$(PORT) -sTCP:LISTEN > /dev/null 2>&1; then \
				printf "$(C_RED)x$(C_RESET) Existing dev server did not release port $(PORT). Stop pid $$LISTENER_PID and retry.\n"; \
				exit 1; \
			fi; \
		else \
			printf "$(C_RED)x$(C_RESET) Port $(PORT) already in use by pid $$LISTENER_PID: $$LISTENER_CMD\n"; \
			exit 1; \
		fi; \
	fi
	@printf "$(C_CYAN)->$(C_RESET) Starting Next.js at http://localhost:$(PORT)...\n"
	@cd $(PROJECT_ROOT) && $(NPM) run dev -- --port $(PORT)

.PHONY: build
build:
	@cd $(PROJECT_ROOT) && $(NPM) run build

.PHONY: start
start:
	@cd $(PROJECT_ROOT) && $(NPM) run start -- --port $(PORT)

.PHONY: lint
lint:
	@cd $(PROJECT_ROOT) && $(NPM) run lint

.PHONY: typecheck
typecheck:
	@cd $(PROJECT_ROOT) && $(NPM) run typecheck

.PHONY: check
check: lint typecheck

.PHONY: hermes-chat
hermes-chat:
	@if ! command -v hermes > /dev/null 2>&1; then \
		printf "$(C_RED)x$(C_RESET) hermes command not found. Install Hermes first.\n"; \
		exit 1; \
	fi
	@printf "$(C_CYAN)->$(C_RESET) Starting Hermes chat for AppLoop...\n"
	@cd $(PROJECT_ROOT) && \
		set -a; \
		if [ -f "$(HERMES_ENV_FILE)" ]; then source "$(HERMES_ENV_FILE)"; fi; \
		if [ -f "$(APP_ENV_FILE)" ]; then source "$(APP_ENV_FILE)"; fi; \
		set +a; \
		if [ -n "$(HERMES_SKILLS)" ]; then \
			HERMES_HOME="$(HERMES_HOME_DIR)" hermes chat --skills "$(HERMES_SKILLS)"; \
		else \
			HERMES_HOME="$(HERMES_HOME_DIR)" hermes chat; \
		fi

.PHONY: hermes-dashboard
hermes-dashboard:
	@if ! command -v hermes > /dev/null 2>&1; then \
		printf "$(C_RED)x$(C_RESET) hermes command not found. Install Hermes first.\n"; \
		exit 1; \
	fi
	@if command -v lsof > /dev/null 2>&1 && lsof -tiTCP:$(HERMES_DASHBOARD_PORT) -sTCP:LISTEN > /dev/null 2>&1; then \
		LISTENER_PID=$$(lsof -tiTCP:$(HERMES_DASHBOARD_PORT) -sTCP:LISTEN | head -n 1); \
		LISTENER_CMD=$$(ps -ww -p $$LISTENER_PID -o command= 2>/dev/null || true); \
		if printf '%s' "$$LISTENER_CMD" | grep -Eq 'hermes|hermes_cli|Python|python'; then \
			printf "$(C_YELLOW)->$(C_RESET) Stopping existing Hermes dashboard on port $(HERMES_DASHBOARD_PORT) (pid $$LISTENER_PID)...\n"; \
			kill $$LISTENER_PID; \
			for _ in {1..60}; do \
				if ! lsof -tiTCP:$(HERMES_DASHBOARD_PORT) -sTCP:LISTEN > /dev/null 2>&1; then break; fi; \
				/bin/sleep 0.5; \
			done; \
			if lsof -tiTCP:$(HERMES_DASHBOARD_PORT) -sTCP:LISTEN > /dev/null 2>&1; then \
				printf "$(C_RED)x$(C_RESET) Existing dashboard did not release port $(HERMES_DASHBOARD_PORT). Stop pid $$LISTENER_PID and retry.\n"; \
				exit 1; \
			fi; \
		else \
			printf "$(C_RED)x$(C_RESET) Port $(HERMES_DASHBOARD_PORT) already in use by pid $$LISTENER_PID: $$LISTENER_CMD\n"; \
			exit 1; \
		fi; \
	fi
	@printf "$(C_CYAN)->$(C_RESET) Starting Hermes dashboard at http://127.0.0.1:$(HERMES_DASHBOARD_PORT)...\n"
	@cd $(PROJECT_ROOT) && \
		set -a; \
		if [ -f "$(HERMES_ENV_FILE)" ]; then source "$(HERMES_ENV_FILE)"; fi; \
		if [ -f "$(APP_ENV_FILE)" ]; then source "$(APP_ENV_FILE)"; fi; \
		set +a; \
		DASHBOARD_EXIT=0; \
		HERMES_HOME="$(HERMES_HOME_DIR)" hermes dashboard --host "127.0.0.1" --port "$(HERMES_DASHBOARD_PORT)" || DASHBOARD_EXIT=$$?; \
		if [ "$$DASHBOARD_EXIT" = "130" ] || [ "$$DASHBOARD_EXIT" = "143" ]; then \
			printf "$(C_YELLOW)->$(C_RESET) Hermes dashboard stopped\n"; exit 0; \
		fi; \
		exit $$DASHBOARD_EXIT

.PHONY: hermes-desktop
hermes-desktop:
	@if ! command -v hermes > /dev/null 2>&1; then \
		printf "$(C_RED)x$(C_RESET) hermes command not found. Install Hermes first.\n"; \
		exit 1; \
	fi
	@mkdir -p "$(HERMES_HOME_DIR)"
	@printf "$(C_CYAN)->$(C_RESET) Launching Hermes Desktop with HERMES_HOME=$(HERMES_HOME_DIR)...\n"
	@cd $(PROJECT_ROOT) && \
		set -a; \
		if [ -f "$(HERMES_ENV_FILE)" ]; then source "$(HERMES_ENV_FILE)"; fi; \
		if [ -f "$(APP_ENV_FILE)" ]; then source "$(APP_ENV_FILE)"; fi; \
		set +a; \
		HERMES_HOME="$(HERMES_HOME_DIR)" hermes desktop $(HERMES_DESKTOP_ARGS)

.PHONY: hermes-update
hermes-update:
	@if ! command -v hermes > /dev/null 2>&1; then \
		printf "$(C_RED)x$(C_RESET) hermes command not found. Install Hermes first.\n"; \
		exit 1; \
	fi
	@mkdir -p "$(HERMES_HOME_DIR)"
	@printf "$(C_CYAN)->$(C_RESET) Updating Hermes for this repo\n"
	@cd $(PROJECT_ROOT) && \
		set -a; \
		if [ -f "$(HERMES_ENV_FILE)" ]; then source "$(HERMES_ENV_FILE)"; fi; \
		if [ -f "$(APP_ENV_FILE)" ]; then source "$(APP_ENV_FILE)"; fi; \
		set +a; \
		HERMES_HOME="$(HERMES_HOME_DIR)" hermes update
	@printf "$(C_GREEN)v$(C_RESET) Hermes update complete\n"

.PHONY: hermes-gateway
hermes-gateway:
	@if ! command -v hermes > /dev/null 2>&1; then \
		printf "$(C_RED)x$(C_RESET) hermes command not found. Install Hermes first.\n"; \
		exit 1; \
	fi
	@if command -v lsof > /dev/null 2>&1 && lsof -tiTCP:$(HERMES_GATEWAY_PORT) -sTCP:LISTEN > /dev/null 2>&1; then \
		LISTENER_PID=$$(lsof -tiTCP:$(HERMES_GATEWAY_PORT) -sTCP:LISTEN | head -n 1); \
		LISTENER_CMD=$$(ps -ww -p $$LISTENER_PID -o command= 2>/dev/null || true); \
		if printf '%s' "$$LISTENER_CMD" | grep -Eq 'hermes|hermes_cli|Python|python'; then \
			printf "$(C_YELLOW)->$(C_RESET) Stopping existing Hermes gateway on port $(HERMES_GATEWAY_PORT) (pid $$LISTENER_PID)...\n"; \
			kill $$LISTENER_PID; \
			for _ in {1..60}; do \
				if ! lsof -tiTCP:$(HERMES_GATEWAY_PORT) -sTCP:LISTEN > /dev/null 2>&1; then break; fi; \
				/bin/sleep 0.5; \
			done; \
			if lsof -tiTCP:$(HERMES_GATEWAY_PORT) -sTCP:LISTEN > /dev/null 2>&1; then \
				printf "$(C_RED)x$(C_RESET) Existing gateway did not release port $(HERMES_GATEWAY_PORT). Stop pid $$LISTENER_PID and retry.\n"; \
				exit 1; \
			fi; \
		else \
			printf "$(C_RED)x$(C_RESET) Port $(HERMES_GATEWAY_PORT) already in use by pid $$LISTENER_PID: $$LISTENER_CMD\n"; \
			exit 1; \
		fi; \
	fi
	@printf "$(C_CYAN)->$(C_RESET) Starting Hermes gateway at http://127.0.0.1:$(HERMES_GATEWAY_PORT)...\n"
	@cd $(PROJECT_ROOT) && \
		set -a; \
		if [ -f "$(HERMES_ENV_FILE)" ]; then source "$(HERMES_ENV_FILE)"; fi; \
		if [ -f "$(APP_ENV_FILE)" ]; then source "$(APP_ENV_FILE)"; fi; \
		set +a; \
		HERMES_HOME="$(HERMES_HOME_DIR)" \
		API_SERVER_ENABLED="$${API_SERVER_ENABLED:-true}" \
		API_SERVER_KEY="$${API_SERVER_KEY:-$(HERMES_GATEWAY_KEY)}" \
		hermes gateway

.PHONY: hermes-gateway-curl-test
hermes-gateway-curl-test:
	@set -a; \
	if [ -f "$(APP_ENV_FILE)" ]; then source "$(APP_ENV_FILE)"; fi; \
	set +a; \
	GATEWAY_PORT="$${API_SERVER_PORT:-$(HERMES_GATEWAY_PORT)}"; \
	printf "$(C_CYAN)->$(C_RESET) Testing Hermes gateway at http://127.0.0.1:$$GATEWAY_PORT...\n"; \
	response=$$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:$$GATEWAY_PORT/v1/runs 2>&1); \
	if [ "$$response" = "000" ]; then \
		printf "$(C_RED)x$(C_RESET) Gateway not reachable. Run $(C_BOLD)make hermes-gateway$(C_RESET) first.\n"; \
		exit 1; \
	fi
	@printf "$(C_GREEN)v$(C_RESET) Gateway is up. Sending test run...\n"
	@set -a; \
	if [ -f "$(APP_ENV_FILE)" ]; then source "$(APP_ENV_FILE)"; fi; \
	set +a; \
	GATEWAY_PORT="$${API_SERVER_PORT:-$(HERMES_GATEWAY_PORT)}"; \
	GATEWAY_KEY="$${API_SERVER_KEY:-$(HERMES_GATEWAY_KEY)}"; \
	curl -s http://127.0.0.1:$$GATEWAY_PORT/v1/runs \
		-H "Authorization: Bearer $$GATEWAY_KEY" \
		-H "Content-Type: application/json" \
		-d '{"input":"/goal Reply with just: OK","instructions":"Minimal test"}' | python3 -m json.tool

.PHONY: mlx-vlm-setup
mlx-vlm-setup:
	@if ! command -v python3 > /dev/null 2>&1; then \
		printf "$(C_RED)x$(C_RESET) python3 command not found. Install Python 3 first.\n"; \
		exit 1; \
	fi
	@if [ ! -x "$(MLX_VLM_VENV)/bin/python" ]; then \
		printf "$(C_CYAN)->$(C_RESET) Creating MLX-VLM virtual environment at $(MLX_VLM_VENV)...\n"; \
		python3 -m venv "$(MLX_VLM_VENV)"; \
	else \
		printf "$(C_CYAN)->$(C_RESET) Reusing MLX-VLM virtual environment at $(MLX_VLM_VENV)...\n"; \
	fi
	@"$(MLX_VLM_VENV)/bin/python" -m pip install -U pip huggingface_hub mlx-vlm mlx-lm
	@printf "$(C_GREEN)v$(C_RESET) MLX-VLM tooling is ready\n"

.PHONY: mlx-vlm-download
mlx-vlm-download: mlx-vlm-setup
	@mkdir -p "$(dir $(MLX_VLM_MODEL_DIR))"
	@printf "$(C_CYAN)->$(C_RESET) Downloading $(MLX_VLM_REPO) into $(MLX_VLM_MODEL_DIR)...\n"
	@"$(MLX_VLM_VENV)/bin/hf" download "$(MLX_VLM_REPO)" --local-dir "$(MLX_VLM_MODEL_DIR)"
	@$(MAKE) mlx-vlm-check-model

.PHONY: mlx-vlm-check-model
mlx-vlm-check-model:
	@missing=0; \
	for file in \
		README.md \
		config.json \
		generation_config.json \
		model.safetensors.index.json \
		model-00001-of-00004.safetensors \
		model-00002-of-00004.safetensors \
		model-00003-of-00004.safetensors \
		model-00004-of-00004.safetensors \
		tokenizer.json \
		tokenizer_config.json; do \
		if [ ! -f "$(MLX_VLM_MODEL_DIR)/$$file" ]; then \
			printf "$(C_RED)x$(C_RESET) Missing $(MLX_VLM_MODEL_DIR)/$$file\n"; \
			missing=1; \
		fi; \
	done; \
	if [ "$$missing" = "1" ]; then \
		printf "$(C_YELLOW)->$(C_RESET) Run $(C_BOLD)make mlx-vlm-download$(C_RESET) again to resume the download.\n"; \
		exit 1; \
	fi; \
	printf "$(C_GREEN)v$(C_RESET) Model files are present in $(MLX_VLM_MODEL_DIR)\n"

.PHONY: mlx-vlm-generate
mlx-vlm-generate: mlx-vlm-check-model
	@if [ ! -x "$(MLX_VLM_VENV)/bin/python" ]; then \
		printf "$(C_RED)x$(C_RESET) Missing $(MLX_VLM_VENV). Run $(C_BOLD)make mlx-vlm-setup$(C_RESET) first.\n"; \
		exit 1; \
	fi
	@"$(MLX_VLM_VENV)/bin/python" -m mlx_lm generate \
		--model "$(MLX_VLM_MODEL_DIR)" \
		--prompt "$(MLX_VLM_PROMPT)" \
		--max-tokens 256 \
		--temp 0 \
		--chat-template-config '$(MLX_CHAT_TEMPLATE_ARGS)' \
		--verbose False

.PHONY: mlx-vlm-server
mlx-vlm-server: mlx-vlm-check-model
	@if [ ! -x "$(MLX_VLM_VENV)/bin/python" ]; then \
		printf "$(C_RED)x$(C_RESET) Missing $(MLX_VLM_VENV). Run $(C_BOLD)make mlx-vlm-setup$(C_RESET) first.\n"; \
		exit 1; \
	fi
	@printf "$(C_CYAN)->$(C_RESET) Starting MLX server at http://$(MLX_VLM_HOST):$(MLX_VLM_PORT)/v1...\n"
	@"$(MLX_VLM_VENV)/bin/python" -m mlx_lm server \
		--host "$(MLX_VLM_HOST)" \
		--port "$(MLX_VLM_PORT)" \
		--model "$(MLX_VLM_MODEL_DIR)" \
		--chat-template-args '$(MLX_CHAT_TEMPLATE_ARGS)' \
		--trust-remote-code

.PHONY: mlx-vlm-curl-test
mlx-vlm-curl-test:
	@printf "$(C_CYAN)->$(C_RESET) Testing MLX-VLM server at http://$(MLX_VLM_HOST):$(MLX_VLM_PORT)/v1/chat/completions...\n"
	@curl -s "http://$(MLX_VLM_HOST):$(MLX_VLM_PORT)/v1/chat/completions" \
		-H "Content-Type: application/json" \
		-d '{"model":"$(MLX_VLM_MODEL_DIR)","messages":[{"role":"user","content":"Reply with exactly: MLX OK"}],"max_tokens":16,"temperature":0}' | python3 -m json.tool

.PHONY: hermes-mlx-vlm-config
hermes-mlx-vlm-config:
	@printf "$(C_BOLD)Environment for .env or .hermes/.env$(C_RESET)\n"
	@printf "HERMES_MODEL=$(MLX_VLM_HERMES_MODEL)\n"
	@printf "HERMES_INFERENCE_MODEL=$(MLX_VLM_HERMES_MODEL)\n"
	@printf "HERMES_INFERENCE_PROVIDER=mlx-vlm\n"
	@printf "HERMES_TUI_PROVIDER=mlx-vlm\n"
	@printf "OPENAI_BASE_URL=http://$(MLX_VLM_HOST):$(MLX_VLM_PORT)/v1\n"
	@printf "OPENAI_API_KEY=not-needed\n"
	@printf "\n$(C_BOLD).hermes/config.yaml route snippet$(C_RESET)\n"
	@printf "platforms:\n"
	@printf "  api_server:\n"
	@printf "    enabled: true\n"
	@printf "    extra:\n"
	@printf "      model_routes:\n"
	@printf "        $(MLX_VLM_HERMES_MODEL):\n"
	@printf "          model: $(MLX_VLM_MODEL_DIR)\n"
	@printf "          provider: mlx-vlm\n"
	@printf "          base_url: http://$(MLX_VLM_HOST):$(MLX_VLM_PORT)/v1\n"
	@printf "          api_key: not-needed\n"

.PHONY: clean
clean:
	@rm -rf $(PROJECT_ROOT)/.next $(PROJECT_ROOT)/out $(PROJECT_ROOT)/dist $(PROJECT_ROOT)/build $(PROJECT_ROOT)/tsconfig.tsbuildinfo

.PHONY: reset
reset: clean
	@rm -rf $(PROJECT_ROOT)/node_modules $(PROJECT_ROOT)/package-lock.json