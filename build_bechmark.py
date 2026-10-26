import json
import random
from pathlib import Path

# ===============================================================
# ROUTEMESH BENCHMARK GENERATOR
#
# Generates:
#   1. tuning_pairs.json
#   2. golden_benchmark_50.json
#
# No external datasets or downloads required.
# ===============================================================

random.seed(7)

OUTPUT_DIR = Path(".")

# ===============================================================
# 1. SEMANTIC CACHE TUNING PAIRS
#
# should_hit:
#   Questions intended to have equivalent meanings.
#
# should_miss:
#   Questions that may look related but require different answers.
#
# These examples are manually curated and should be reviewed
# against your application's expected answer-reuse policy.
# ===============================================================

positive_pairs = [
    # REST APIs
    {
        "a": "What is a REST API?",
        "b": "Can you explain what a REST API is?"
    },
    {
        "a": "What does a REST API do?",
        "b": "What is the purpose of a REST API?"
    },

    # Networking
    {
        "a": "What is the difference between TCP and UDP?",
        "b": "How do TCP and UDP differ?"
    },
    {
        "a": "How does DNS resolve a domain name?",
        "b": "How does DNS translate a domain name into an IP address?"
    },

    # Databases
    {
        "a": "What is the purpose of a database index?",
        "b": "Why do databases use indexes?"
    },
    {
        "a": "What is the difference between SQL and NoSQL?",
        "b": "How do SQL databases differ from NoSQL databases?"
    },

    # Machine learning
    {
        "a": "What is overfitting in machine learning?",
        "b": "What does it mean when a machine learning model overfits?"
    },
    {
        "a": "What is the difference between classification and regression?",
        "b": "How does classification differ from regression in machine learning?"
    },

    # RouteMesh-related concepts
    {
        "a": "What is semantic caching in an LLM gateway?",
        "b": "How does semantic caching work in an LLM proxy?"
    },
    {
        "a": "What is a circuit breaker in a distributed system?",
        "b": "Why are circuit breakers used in distributed systems?"
    },
    {
        "a": "What does a load balancer do?",
        "b": "What is the purpose of a load balancer?"
    },
    {
        "a": "What is an API gateway?",
        "b": "What role does an API gateway serve?"
    },
    {
        "a": "What is provider failover?",
        "b": "What does failover between service providers mean?"
    },
    {
        "a": "What is model routing in an LLM gateway?",
        "b": "How does an LLM gateway choose which model to use?"
    },

    # Software development
    {
        "a": "What is the purpose of Docker containers?",
        "b": "Why do developers use Docker containers?"
    },
    {
        "a": "What is version control?",
        "b": "Why is version control used in software development?"
    },
    {
        "a": "What is the difference between authentication and authorization?",
        "b": "How are authentication and authorization different?"
    },
    {
        "a": "What is a Python virtual environment?",
        "b": "Why are virtual environments used in Python?"
    },
    {
        "a": "What is binary search?",
        "b": "How does the binary search algorithm work?"
    },
    {
        "a": "What is an embedding in a large language model application?",
        "b": "How are embeddings used in LLM applications?"
    },
]


negative_pairs = [
    # Related networking questions with different meanings
    {
        "a": "How does TCP establish a connection?",
        "b": "How does UDP transmit data without establishing a connection?"
    },
    {
        "a": "What does DNS do?",
        "b": "How does DHCP assign IP addresses?"
    },

    # Related database questions with different meanings
    {
        "a": "How do I create a database index?",
        "b": "How do I delete a database index?"
    },
    {
        "a": "How do I insert a row into a SQL table?",
        "b": "How do I delete a row from a SQL table?"
    },
    {
        "a": "How do I connect Python to PostgreSQL?",
        "b": "How do I connect Python to MongoDB?"
    },

    # Machine learning questions with different meanings
    {
        "a": "What is supervised learning?",
        "b": "What is unsupervised learning?"
    },
    {
        "a": "How does logistic regression work?",
        "b": "How does linear regression work?"
    },
    {
        "a": "How do I calculate precision for a classifier?",
        "b": "How do I calculate recall for a classifier?"
    },

    # Similar terminology, different technical requirements
    {
        "a": "How do I authenticate a user with JWT?",
        "b": "How do I authorize a user to access an admin endpoint?"
    },
    {
        "a": "How do I configure a Docker container's memory limit?",
        "b": "How do I configure a Docker container's CPU limit?"
    },
    {
        "a": "How do I configure an HTTP server to use port 8080?",
        "b": "How do I configure an HTTP server to use port 8443?"
    },
    {
        "a": "How can I reduce API response latency?",
        "b": "How can I increase API request throughput?"
    },

    # RouteMesh-specific distinctions
    {
        "a": "How should I configure a semantic cache similarity threshold?",
        "b": "How should I configure a circuit breaker failure threshold?"
    },
    {
        "a": "How do I configure a fallback provider after a timeout?",
        "b": "How do I configure a fallback provider after an HTTP 429 response?"
    },
    {
        "a": "How can I reduce the number of LLM API calls?",
        "b": "How can I reduce the cost per million LLM input tokens?"
    },
    {
        "a": "How should an LLM gateway route simple prompts?",
        "b": "How should an LLM gateway route complex reasoning prompts?"
    },
    {
        "a": "How do I set a cache expiration time of 60 seconds?",
        "b": "How do I set a cache expiration time of 600 seconds?"
    },
    {
        "a": "How can I detect HTTP 500 errors from a provider?",
        "b": "How can I detect HTTP 429 rate-limit responses from a provider?"
    },
    {
        "a": "How do I configure a Redis cache?",
        "b": "How do I configure a Redis message queue?"
    },
    {
        "a": "How can I increase the semantic cache hit rate?",
        "b": "How can I reduce false-positive semantic cache matches?"
    },
]


def validate_pairs(pairs, name):
    """Check pair structure and reject identical question text."""

    for index, pair in enumerate(pairs, start=1):
        if not isinstance(pair.get("a"), str):
            raise ValueError(f"{name} pair {index}: 'a' must be a string.")

        if not isinstance(pair.get("b"), str):
            raise ValueError(f"{name} pair {index}: 'b' must be a string.")

        if not pair["a"].strip() or not pair["b"].strip():
            raise ValueError(f"{name} pair {index}: questions cannot be empty.")

        if pair["a"].strip().casefold() == pair["b"].strip().casefold():
            raise ValueError(f"{name} pair {index}: questions are identical.")


validate_pairs(positive_pairs, "Positive")
validate_pairs(negative_pairs, "Negative")


# Preserve the format used by the previous script.
tuning_pairs = {
    "should_hit": [
        {
            "a": pair["a"],
            "b": pair["b"],
            "src": "manual"
        }
        for pair in positive_pairs
    ],
    "should_miss": [
        {
            "a": pair["a"],
            "b": pair["b"],
            "src": "manual"
        }
        for pair in negative_pairs
    ]
}


# ===============================================================
# 2. GOLDEN BENCHMARK
#
# 10 original prompts + 10 paraphrases + 20 fast prompts
# + 10 reasoning prompts = 50 prompts.
# ===============================================================

base = [
    {
        "a": "What is a REST API?",
        "b": "What does a REST API do?"
    },
    {
        "a": "What is the difference between TCP and UDP?",
        "b": "How do TCP and UDP differ?"
    },
    {
        "a": "How does DNS resolve a domain name?",
        "b": "What happens when DNS looks up a domain name?"
    },
    {
        "a": "What is semantic caching in an LLM gateway?",
        "b": "How does semantic caching work in an LLM proxy?"
    },
    {
        "a": "What is the purpose of a database index?",
        "b": "Why do databases use indexes?"
    },
    {
        "a": "What is the difference between supervised and unsupervised learning?",
        "b": "How does supervised learning differ from unsupervised learning?"
    },
    {
        "a": "What does a circuit breaker do in a distributed system?",
        "b": "Why are circuit breakers used in distributed systems?"
    },
    {
        "a": "What is the purpose of Docker containers?",
        "b": "Why are Docker containers used?"
    },
    {
        "a": "How does a load balancer distribute incoming requests?",
        "b": "What does a load balancer do with incoming requests?"
    },
    {
        "a": "What is the difference between authentication and authorization?",
        "b": "How are authentication and authorization different?"
    }
]


# 20 straightforward technical prompts
fast = [
    "Explain the difference between a list and a tuple in Python.",
    "What is the purpose of a virtual environment in Python?",
    "Explain how a hash table stores and retrieves values.",
    "What is the difference between HTTP and HTTPS?",
    "Explain the purpose of version control in software development.",
    "What is the difference between a process and a thread?",
    "Explain how binary search works on a sorted array.",
    "What is the purpose of an index in a relational database?",
    "Explain the difference between SQL and NoSQL databases.",
    "What is the role of an API gateway in a microservices architecture?",
    "Explain the purpose of Docker in application deployment.",
    "What is the difference between authentication and authorization?",
    "Explain what overfitting means in machine learning.",
    "What is the purpose of feature scaling in machine learning?",
    "Explain the difference between classification and regression.",
    "What is an embedding in a large language model application?",
    "Explain how a cache can reduce API response latency.",
    "What is the purpose of a circuit breaker in a distributed system?",
    "Explain the difference between latency and throughput.",
    "What is the purpose of unit testing in software development?"
]


# 10 technical reasoning prompts
reasoning = [
    (
        "A service receives 1,000 requests per second. Its cache hit rate "
        "is 70 percent. Each cache miss triggers one model API call. "
        "How many model API calls occur per second, and what happens "
        "if the hit rate increases to 85 percent?"
    ),
    (
        "An LLM gateway routes requests to a fast model costing $0.20 "
        "per million tokens and a reasoning model costing $2.00 per "
        "million tokens. Given 800 fast-tier requests averaging 500 "
        "tokens and 200 reasoning-tier requests averaging 1,000 tokens, "
        "calculate the total input-token cost."
    ),
    (
        "A semantic cache uses cosine similarity with a threshold of 0.90. "
        "Three candidate prompts have similarity scores of 0.94, 0.87, "
        "and 0.91. Determine which candidates pass the threshold and "
        "explain why a high similarity score alone cannot guarantee "
        "that returning a cached answer is safe."
    ),
    (
        "A service sends requests to Provider A. After five consecutive "
        "failures, its circuit breaker opens for 30 seconds. Explain "
        "how this affects incoming requests, what should happen after "
        "the timeout, and how a fallback provider can improve availability."
    ),
    (
        "A distributed application receives 2,400 requests per minute. "
        "A rate limiter allows 30 requests per second. Calculate the "
        "average incoming request rate and determine whether the limit "
        "is exceeded, assuming requests are evenly distributed."
    ),
    (
        "A machine learning classifier has 95 percent accuracy on a "
        "dataset where only 5 percent of examples belong to the positive "
        "class. Explain why accuracy may be misleading and identify "
        "additional metrics suitable for evaluating the classifier."
    ),
    (
        "A database query takes 800 milliseconds before indexing and "
        "120 milliseconds after indexing. Calculate the percentage "
        "reduction in query latency and explain why an index may "
        "increase storage requirements or slow down writes."
    ),
    (
        "An API gateway routes simple prompts to a fast model and complex "
        "prompts to a reasoning model. Explain how you would design an "
        "evaluation dataset, measure routing errors, and prevent "
        "complex requests from being incorrectly sent to the fast tier."
    ),
    (
        "A service has a 60 percent cache hit rate and processes 5,000 "
        "requests. Assume every cache miss requires one model call. "
        "Calculate the number of model calls and the percentage reduction "
        "in model calls compared with a system without caching."
    ),
    (
        "Two model providers have different latency and failure rates. "
        "Design a routing strategy that considers request complexity, "
        "provider availability, response latency, and API cost. Explain "
        "how you would test the strategy under simulated provider failures."
    )
]


# ===============================================================
# 3. BUILD THE 50-PROMPT BENCHMARK
# ===============================================================

prompts = []
prompt_id = 1

# First 10: Original prompts
for index, pair in enumerate(base, start=1):
    prompts.append({
        "id": prompt_id,
        "prompt": pair["a"],
        "group": "base",
        "expected_tier": "fast",
        "expected_cache_hit": False,
        "paraphrase_of": None
    })

    prompt_id += 1


# Next 10: Paraphrases of the original prompts
for index, pair in enumerate(base, start=1):
    prompts.append({
        "id": prompt_id,
        "prompt": pair["b"],
        "group": "paraphrase",
        "expected_tier": "fast",
        "expected_cache_hit": True,
        "paraphrase_of": index
    })

    prompt_id += 1


# Next 20: Straightforward prompts
for prompt in fast:
    prompts.append({
        "id": prompt_id,
        "prompt": prompt,
        "group": "fast",
        "expected_tier": "fast",
        "expected_cache_hit": False,
        "paraphrase_of": None
    })

    prompt_id += 1


# Final 10: Reasoning prompts
for prompt in reasoning:
    prompts.append({
        "id": prompt_id,
        "prompt": prompt,
        "group": "reasoning",
        "expected_tier": "reasoning",
        "expected_cache_hit": False,
        "paraphrase_of": None
    })

    prompt_id += 1


# ===============================================================
# 4. VALIDATE THE GENERATED DATA
# ===============================================================

assert len(base) == 10, "Expected exactly 10 base pairs."
assert len(fast) == 20, "Expected exactly 20 fast prompts."
assert len(reasoning) == 10, "Expected exactly 10 reasoning prompts."
assert len(prompts) == 50, "Expected exactly 50 golden prompts."

assert len(tuning_pairs["should_hit"]) == len(positive_pairs)
assert len(tuning_pairs["should_miss"]) == len(negative_pairs)

assert len({p["id"] for p in prompts}) == 50

for prompt in prompts:
    assert prompt["prompt"].strip(), (
        f"Prompt {prompt['id']} is empty."
    )


# ===============================================================
# 5. WRITE OUTPUT FILES
# ===============================================================

tuning_path = OUTPUT_DIR / "tuning_pairs.json"
golden_path = OUTPUT_DIR / "golden_benchmark_50.json"

with tuning_path.open("w", encoding="utf-8") as file:
    json.dump(
        tuning_pairs,
        file,
        indent=2,
        ensure_ascii=False
    )

with golden_path.open("w", encoding="utf-8") as file:
    json.dump(
        {
            "version": 1,
            "prompts": prompts
        },
        file,
        indent=2,
        ensure_ascii=False
    )


# ===============================================================
# 6. REPORT
# ===============================================================

print("\n" + "=" * 50)
print("ROUTEMESH BENCHMARK GENERATION COMPLETE")
print("=" * 50)

print(f"\nPositive cache pairs: {len(tuning_pairs['should_hit'])}")
print(f"Negative cache pairs: {len(tuning_pairs['should_miss'])}")
print(f"Golden benchmark prompts: {len(prompts)}")

print("\nGolden benchmark breakdown:")
print(f"  Base prompts:       {len(base)}")
print(f"  Paraphrase prompts: {len(base)}")
print(f"  Fast prompts:       {len(fast)}")
print(f"  Reasoning prompts:  {len(reasoning)}")

print("\nFiles created:")
print(f"  {tuning_path.resolve()}")
print(f"  {golden_path.resolve()}")
