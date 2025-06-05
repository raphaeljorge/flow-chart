## Product Documentation: Node-Based Software Builder Backend

### 1. Introduction and Strategic Vision

The **Node-Based Software Builder** is envisioned as a next-generation visual development platform. Its mission is to empower users—from developers to technically-savvy business analysts—to construct a wide array of software applications. This includes APIs, microservices, process automations, integrations with messaging services (like WhatsApp), database interactions, and integrations with Large Language Models (LLMs), all through a node-based visual interface.

The backend of this platform is the engine that brings this vision to life, focusing on:

* **Exceptional Performance:** Ensuring that applications built by users achieve performance comparable or even superior (in terms of optimized base code per node) to traditionally hand-coded implementations, primarily through compilation to native Go code.
* **Deep Extensibility:** Allowing for the easy addition of new functionalities and node types, both by the platform team and, in the future, by the community or users themselves.
* **Agile Developer Experience:** Offering tools and workflows that permit rapid prototyping, efficient testing, and clear debugging, even within the context of a visual system that generates compiled code.
* **Robustness and Scalability:** Building an architecture that supports a growing number of users, complex projects, and a high volume of executions.

### 2. General Backend Architecture

The backend will be designed following an **API-First** philosophy, with modular components that can evolve into microservices. Communication between the Visual Editor (frontend) and the backend will be centralized through an API Gateway.

**Key Architectural Principles:**

* **Modularity:** Well-defined components with clear responsibilities.
* **Horizontal Scalability:** Services should be designed to scale independently.
* **Extensibility:** Clear interfaces for adding new node types and platform functionalities.
* **Performance as a Requirement:** Design decisions (like AOT compilation to Go) are driven by maximizing the performance of the generated applications.
* **Security:** Data protection and controlled access to resources.
* **Observability:** Integrated logging, tracing, and monitoring.

**Core Technologies (Proposed):**

* **Primary Language:** Go (Golang) for performance-critical backend services (Execution Engine, Node Executors, Code Generation, Compilation) and for the generated code of user applications.
* **API Gateway/BFF and some management services:** May use Node.js with TypeScript for agility and integration with the JS ecosystem if desired, or also Go.
* **Databases:**
    * **Platform Metadata (Projects, Node Definitions, Users, Connectors):** PostgreSQL (preferred for robustness and ACID features) or MongoDB (for flexibility with JSON schemas, especially for flow definitions).
    * **Logs and Telemetry:** Elasticsearch, Loki, or a cloud logging service.
    * **Cache:** Redis or Memcached.
* **Message Queues (for asynchronous tasks and decoupling):** RabbitMQ, Kafka, or NATS. Essential for the Execution Engine, Compilation Service, and notifications.
* **Containerization:** Docker.
* **Orchestration (Future):** Kubernetes.

### 3. Detailed Backend Components and Services

#### 3.1. API Gateway / BFF (Backend for Frontend)

* **Purpose:** Single entry point for all requests originating from the Visual Editor.
* **Responsibilities:**
    * Authentication of frontend requests (e.g., via JWT).
    * Authorization (verification of user permissions to access/modify resources).
    * Intelligent routing of requests to the appropriate internal services.
    * Rate limiting and abuse protection.
    * Aggregation of responses from multiple microservices, if necessary, to optimize communication with the frontend.
    * Payload transformation between the frontend format and the format expected by internal services.

#### 3.2. Project Management Service

* **Purpose:** Manage the lifecycle of software projects/flows created by users.
* **Responsibilities:**
    * CRUD (Create, Read, Update, Delete) operations for projects. A "project" encapsulates the visual flow definition (nodes, connections, configurations), associated metadata, and its versions.
    * **Flow Versioning with Git (Internal):**
        * Each project is managed internally as a Git repository.
        * When a flow is saved, the service performs a `commit` of the flow's serialized definition (e.g., JSON).
        * Maintain a complete history of changes, allowing rollback to previous versions.
        * Provide APIs for the editor to visualize commit history and restore versions.
    * **User's Git Repository Integration (Future):**
        * Allow users to connect their platform projects to personal GitHub/GitLab repositories.
        * Synchronize (push) flow definitions and, optionally, the generated Go code to the user's repository.
        * Manage OAuth authentication with Git providers.
    * Store project metadata: name, description, owner, access permissions (if collaboration exists).
    * Manage the "build state" of a project (e.g., not compiled, compiling, compiled successfully, compilation failed).
    * Track the versions of platform nodes used in each project version.
* **Interactions:**
    * Visual Editor: To save, load, list, and version projects.
    * Execution Engine: To obtain the flow definition to be executed/compiled.
    * Node Catalog Service: To validate the versions of referenced nodes.

#### 3.3. Node Catalog Service

* **Purpose:** Central repository for all definitions and implementations of functional nodes on the platform.
* **Responsibilities:**
    * Store and serve **node metadata** for the Visual Editor:
        * Type ID, title, description, category, icon, configuration schema (JSON Schema).
    * Manage **versions** for each functional node type. Each node (e.g., "Send Email v1.0", "Send Email v1.1") will have its implementation versioned.
    * Store or reference the **Go code templates** or pre-compiled Go modules containing the execution logic for each version of each node.
    * Provide APIs for the Visual Editor to list available nodes (with filters by category, etc.) and get the configuration schema of a specific node.
    * Provide APIs for the `Code Generation Engine` to obtain the Go code template or Go module reference for a specific node version.
    * (Future) Support the registration and management of custom/forked nodes by users.
* **Interactions:**
    * Visual Editor: To populate the node palette and configuration panel.
    * Code Generation Engine: To get the Go code/template for nodes.
    * Project Management Service: To validate node definitions within a project.

#### 3.4. LLM Integration Service

* **Purpose:** Provide a centralized and abstracted interface for interacting with various Large Language Models.
* **Responsibilities:**
    * Manage API keys and configurations for different LLM providers (OpenAI, Gemini, etc.).
    * Expose endpoints for:
        * **Flow Construction Assistance:** Receive natural language descriptions from the Visual Editor and suggest node sequences, configurations, or complete flows.
        * **Node Compatibility:** Analyze input/output schemas of two nodes and suggest/generate the logic (e.g., transformation script, configuration for a "Data Mapper" node) for an adapter node.
        * **Node Customization (Code Generation/Modification):** Receive the intent for node customization (described by the user or inferred) and attempt to generate or modify the Go code of the corresponding "forked" node.
        * **LLM Node Execution:** Serve as a backend for platform functional nodes that encapsulate calls to LLMs (e.g., "Text Generation Node," "Classification Node").
    * Maintain a cache of common responses or contexts to optimize costs and latency.
* **Interactions:**
    * Visual Editor: For the construction assistant.
    * Node Executors (via Execution Engine): For nodes that use LLMs.
    * (Future) User Code Service: When generating code for custom nodes.

#### 3.5. Connector Service

* **Purpose:** Securely manage connection configurations to external services used by the flows.
* **Responsibilities:**
    * Allow users to configure and store (in encrypted form) credentials and connection details for:
        * Databases (PostgreSQL, MySQL, MongoDB, etc.).
        * Email Providers (SMTP).
        * Third-party APIs (storage of API keys, base URLs).
        * Messaging Services.
    * Provide a secure API for `Node Executors` (at runtime) to obtain the credentials/configurations of a specific connector referenced by a node.
    * Test the validity of configured connections.
* **Interactions:**
    * Visual Editor (via API Gateway): For users to manage their connectors.
    * Node Executors (via Execution Engine): To obtain connection details at runtime.

#### 3.6. (Future) User Code Service

* **Purpose:** Manage the Go code of nodes that have been "forked" and/or customized by users.
* **Responsibilities:**
    * Store the Go source code of custom nodes, associated with the user/project.
    * Version this custom code (potentially using Git internally for each "fork").
    * Provide an interface (API) for the `Code Generation Engine` and `Compiler Service` to access the correct version of a node's custom code when building the user's application.
    * (Optional) Integrate with a lightweight web editor or synchronization system to allow users to edit this code.

### 4. Flow Execution Architecture

The platform will primarily adopt an **Ahead-Of-Time (AOT) Compilation to Go** strategy for maximum performance, supplemented by a **Development & Simulation Mode** for an enhanced editor experience.

#### 4.1. Ahead-Of-Time (AOT) Compilation to Go (Production Flow)

* **Objective:** Transform the visual flow into an autonomous and optimized Go binary.
* **Components Involved:**
    * **`Project Management Service`**: Provides the serialized flow definition.
    * **`Node Catalog Service`**: Provides the Go code templates/modules for each node.
    * **`Code Generation Engine Service`**:
        1.  Receives the flow definition.
        2.  **Flow Parsing:** Interprets the graph of nodes and connections.
        3.  **Node Code Selection:** For each node in the flow, obtains the corresponding Go code template (for the correct version) from the `Node Catalog Service` (or from the `User Code Service` if it's a custom node).
        4.  **Flow Logic Generation:** Generates the main Go code that:
            * Defines the application structure (e.g., an HTTP server for an API).
            * Instantiates and configures each node with user-defined parameters.
            * Manages data flow between nodes (passing outputs of one node to inputs of others).
            * Implements control logic (conditionals, loops) translated from the visual design.
            * Injects standardized structured logging and OpenTelemetry instrumentation.
            * Handles global and node-specific error handling.
        5.  **Output:** A set of `.go` files representing the complete application.
    * **`Compiler Service`**:
        1.  Receives the generated `.go` files.
        2.  Executes `go build` to compile the code into an executable binary.
        3.  Manages Go dependencies.
        4.  Stores the compiled artifact and notifies the `Project Management Service` of the build status.
* **`Node Executors Go Library` (within `platform/node_catalog/categories/`)**:
    * A collection of Go packages, each implementing the functionality of one or more node types.
    * Each node executor is a Go function or struct that:
        * Receives an execution context (input data, node configuration, access to connectors).
        * Performs its specific task (e.g., HTTP call, DB query).
        * Returns output data and/or an error status.
        * Implements detailed logging and tracing.
        * Is written with a focus on performance, security, and reusability.

#### 4.2. Development & Simulation Mode (Supporting the Visual Editor)

* **Objective:** Provide rapid feedback and testing capabilities within the Visual Editor without requiring a full Go compilation cycle.
* **Strategies:**
    1.  **TypeScript/JavaScript Simulation Engine in the Editor:**
        * For standard platform nodes, simplified TS/JS implementations can simulate data transformation logic and expected port behavior.
        * The editor executes this code locally.
        * **Limitation:** Does not reflect customizations made directly in a node's Go code. Real I/O (HTTP, DB) is mocked.
    2.  **Remote Sandboxed Execution for Go Nodes (Node Test Mode):**
        * When a user wants to test a specific node (especially a custom Go node) or a small flow segment:
            * The editor sends the node/segment definition, custom Go code (if applicable), and input data to a development backend endpoint.
            * The backend compiles (using a "watch mode" for agility with custom Go code changes) and executes this small piece in a sandboxed Go environment.
            * Results (outputs, logs) are returned to the editor for display.
        * **Advantage:** Tests the actual Go code, including customizations.
        * **Challenge:** Network latency and the need for a backend infrastructure for these "live" tests.
    3.  **(Advanced/Future) Go to WebAssembly (WASM) for Client-Side Simulation:**
        * The Go code for each node (standard or custom) is compiled to WASM.
        * The editor loads and executes these WASM modules.
        * **Advantage:** Executes Go on the client, reflecting customizations.
        * **Challenge:** WASM build pipeline complexity, I/O limitations of WASM in the browser (requires significant mocking), WASM performance, binary sizes.

    The initial approach for simulating custom Go nodes will likely rely on **Remote Sandboxed Execution** (2), while data logic simulation for standard nodes can use **TS/JS in the Editor** (1).

### 5. Developer Experience Support Features

#### 5.1. Debugging

* **In the Editor (Simulation Mode):**
    * Visual inspection of data on connections and node outputs.
    * Possibility of visual "breakpoints" on nodes to pause simulation.
    * Log panel in the editor displaying outputs from the simulation.
* **Compiled Applications (Go):**
    * **Structured Logging:** The `Code Generation Engine` injects calls to a structured logging system (e.g., Go's `log/slog`) at key points in the generated Go code and within each `Node Executor Go Library`. Logs should be easily correlatable with flow execution and the specific node.
    * **Distributed Tracing (OpenTelemetry):** Instrumentation with OpenTelemetry will be standard in the generated Go code, allowing request flows to be traced across executed nodes.
    * **Platform Observability Interface:** The backend will provide an interface (or integrate with tools like Grafana/Prometheus/Jaeger) for users to view logs and traces of their applications in production, ideally with references back to the visual flow design.

#### 5.2. Node Update Management

* The `Node Catalog Service` versions Go node implementations.
* The `Project Management Service` tracks which version of each node a project uses.
* When a new version of a platform node is released:
    * The system notifies users whose projects use older versions.
    * The user can choose to update. Approval triggers a new code generation and compilation of their project using the updated node version.

#### 5.3. Node Customization (LLM-Assisted and "Forking")

* **LLM-Powered Compatibility:**
    * The `LLM Integration Service` assists in creating "adapter/transformer nodes" when schema incompatibility occurs between a node's output and another's input.
    * It can generate the configuration for a generic "Data Mapper" node or even a simple script for a "Custom Logic" node.
* **Node "Forking":**
    * Users can "fork" a standard platform node.
    * The `User Code Service` (future) stores a copy of the node's Go code for the user.
    * **Customization:**
        * **LLM-Assisted:** User describes the change; LLM attempts to modify the forked Go code.
        * **Manual (Advanced):** Users (with Go knowledge) can directly edit their forked Go code via a platform-provided interface or by syncing with their own development environment.
    * The `Compiler Service` uses the forked/customized node version when compiling the user's project.
    * **Security:** Executing arbitrary user-provided Go code (even modified forks) requires a highly secure and sandboxed compilation and execution environment in the backend.

### 6. Key Data Models (Conceptual, for Backend)

* **Project (`Project`):**
    * ID, Name, Description, OwnerID, Timestamps, InternalGitRepositoryID.
    * Reference to Active Flow Definition(s).
* **Flow Definition (`FlowDefinition`):**
    * ID, ProjectID, Version (internal Git commit hash), `definition_json` (visual graph representation, node configurations, etc.), `node_version_map` (mapping flow node instance ID to `platform_node_type_id` and `platform_node_version_id` from catalog).
* **Platform Node Definition (`PlatformNodeDefinition`):**
    * `platform_node_type_id` (e.g., `core/send_email`), `version_id` (e.g., `1.2.0`), Name, Description, Category, Icon, `config_schema_json`, `go_executor_reference` (e.g., path to Go module or function name).
* **User Custom Node (`UserCustomNode` - Future):**
    * ID, UserID, `base_platform_node_type_id` (forked from), `base_platform_node_version_id`, `custom_go_code_reference` (path to user's Go code), CustomVersion.
* **Connector (`Connector`):**
    * ID, UserID, Name, Type (DB, SMTP, API_KEY), `config_encrypted_json`, Timestamps.
* **Flow Execution Record (`FlowExecutionRecord`):**
    * ID, FlowDefinitionID, Status (RUNNING, COMPLETED, FAILED), StartTime, EndTime, `trigger_info_json`, `input_payload_json`, `final_output_json` (or error).
* **Node Execution Log (`NodeExecutionLog`):**
    * ID, FlowExecutionRecordID, `node_instance_id_in_flow`, `platform_node_type_id`, `platform_node_version_id`, Timestamp, Level (INFO, ERROR), Message, `data_json` (relevant context/data).