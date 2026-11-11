/**
 * Eduqe Client-Side Exam PDF Parser
 * Parses multi-page certification exam dump PDFs (e.g. PassLeader, ExamTopics, Microsoft, AWS)
 * directly in the browser using Mozilla PDF.js.
 *
 * Runs 100% client-side, bypassing serverless upload size limits (e.g. Vercel 4.5MB HTTP 413).
 */

export const AB100_EXACT_PATCHES = {
  "6": {
    "question_type": "hotspot",
    "question_text": "Which existing tool and data should you use to gather the required metrics for stakeholder signoff for the AI agents?",
    "answer_options": [
      {
        "id": "stmt_1",
        "statement": "Tool:",
        "options": [
          "Microsoft Foundry",
          "Azure Resource Monitor (ARM)",
          "Dynamics 365 Sales",
          "Microsoft Copilot Studio"
        ]
      },
      {
        "id": "stmt_2",
        "statement": "Data required for the tool:",
        "options": [
          "the cumulative time spent on the task over the past year",
          "the current cost to complete the tasks per instance",
          "the current time to complete the task today per instance",
          "the current cost of the Dynamics 365 Sales licenses"
        ]
      }
    ],
    "correct_answer": {
      "stmt_1": "Microsoft Foundry",
      "stmt_2": "the current time to complete the task today per instance"
    }
  },
  "7": {
    "question_type": "hotspot",
    "question_text": "Which framework should you use to meet the AI agent requirements for the sales cycle enablement?",
    "answer_options": [
      {
        "id": "stmt_1",
        "statement": "For Microsoft Copilot Studio best practices:",
        "options": [
          "the ALM Accelerator for Microsoft Power Platform",
          "Microsoft Cloud Adoption Framework for Azure",
          "Microsoft Power Platform Well-Architected framework",
          "Success by Design"
        ]
      },
      {
        "id": "stmt_2",
        "statement": "For conversational user experiences:",
        "options": [
          "the ALM Accelerator for Microsoft Power Platform",
          "Microsoft Cloud Adoption Framework for Azure",
          "Microsoft Power Platform Well-Architected framework",
          "Success by Design"
        ]
      }
    ],
    "correct_answer": {
      "stmt_1": "the ALM Accelerator for Microsoft Power Platform",
      "stmt_2": "Microsoft Power Platform Well-Architected framework"
    }
  },
  "8": {
    "question_type": "hotspot",
    "question_text": "Which components should you use to meet the sales cycle enablement requirements?",
    "answer_options": [
      {
        "id": "stmt_1",
        "statement": "For AI agent creation:",
        "options": [
          "Microsoft Foundry",
          "Dynamics 365 Sales",
          "Microsoft Copilot Studio",
          "the Power Platform admin center"
        ]
      },
      {
        "id": "stmt_2",
        "statement": "For unexpected AI agent actions:",
        "options": [
          "a custom connector",
          "an event trigger",
          "a Fallback topic",
          "a REST API"
        ]
      }
    ],
    "correct_answer": {
      "stmt_1": "Microsoft Copilot Studio",
      "stmt_2": "a Fallback topic"
    }
  },
  "11": {
    "question_type": "hotspot",
    "question_text": "A company uses Microsoft Dynamics 365 Supply Chain Management. You are designing an AI solution for customer order processing and demand forecasting. You need to recommend Microsoft components that meet the following requirements:\n- Provide AI-driven insights from customer orders\n- Anticipate future product needs\n\nWhat should you recommend for each requirement?",
    "answer_options": [
      {
        "id": "stmt_1",
        "statement": "Provide AI-driven insights from customer orders:",
        "options": [
          "AI Summaries with Copilot",
          "Generative insights for Demand planning",
          "The Customer credit and collections workspace",
          "Workload insights with Copilot"
        ]
      },
      {
        "id": "stmt_2",
        "statement": "Anticipate future product needs:",
        "options": [
          "Generative insights for Demand planning",
          "Microsoft Power BI",
          "Product information management",
          "The Supplier Communications Agent"
        ]
      }
    ],
    "correct_answer": {
      "stmt_1": "AI Summaries with Copilot",
      "stmt_2": "Generative insights for Demand planning"
    }
  },
  "12": {
    "question_type": "hotspot",
    "question_text": "A company has a Microsoft 365 tenant that contains PDF files in SharePoint. The PDF files contain company policies. You need to design an AI solution that uses the PDF files as knowledge sources. What should you recommend for each requirement?",
    "answer_options": [
      {
        "id": "stmt_1",
        "statement": "Enable the agent to answer questions about company policies:",
        "options": [
          "Build a custom model in Microsoft Foundry.",
          "From Copilot Studio, add SharePoint as a knowledge source.",
          "Import the PDFs into Microsoft Dataverse.",
          "Use AI Builder to process and feed SharePoint content."
        ]
      },
      {
        "id": "stmt_2",
        "statement": "Identify which departments and policies are connected:",
        "options": [
          "Apply Microsoft Purview sensitivity labels.",
          "Create a Microsoft Dataverse table for the departments.",
          "From Copilot Studio, configure the SharePoint tool.",
          "Upgrade to SharePoint Premium."
        ]
      }
    ],
    "correct_answer": {
      "stmt_1": "From Copilot Studio, add SharePoint as a knowledge source.",
      "stmt_2": "Create a Microsoft Dataverse table for the departments."
    }
  },
  "13": {
    "question_type": "matching",
    "question_text": "You need to design a Microsoft Copilot Studio agent that meets the following requirements:\n- Supports interactive speech responses\n- Optimizes decision-making and response accuracy\n\nWhat should you recommend for each requirement?",
    "answer_options": {
      "source_title": "Options",
      "target_title": "Requirements / Answer Area",
      "sources": [
        {
          "id": "src_1",
          "text": "A deep reasoning model"
        },
        {
          "id": "src_2",
          "text": "Azure Language in Foundry Tools"
        },
        {
          "id": "src_3",
          "text": "Azure AI Speech"
        },
        {
          "id": "src_4",
          "text": "Copilot Studio voice features"
        },
        {
          "id": "src_5",
          "text": "Speech Synthesis Markup Language (SSML)"
        }
      ],
      "targets": [
        {
          "id": "tgt_1",
          "text": "Supports interactive speech responses:",
          "correct_source_id": "src_3"
        },
        {
          "id": "tgt_2",
          "text": "Optimizes decision-making and response accuracy:",
          "correct_source_id": "src_1"
        }
      ],
      "pairs": [
        {
          "source_id": "src_3",
          "target_id": "tgt_1"
        },
        {
          "source_id": "src_1",
          "target_id": "tgt_2"
        }
      ]
    },
    "correct_answer": {
      "tgt_1": "src_3",
      "tgt_2": "src_1"
    }
  },
  "17": {
    "question_type": "hotspot",
    "question_text": "You are designing an AI strategy for an enterprise. You need to configure knowledge source requirements for Microsoft Copilot Studio agents. What should you configure for each requirement?",
    "answer_options": [
      {
        "id": "stmt_1",
        "statement": "Custom knowledge sources:",
        "options": [
          "Must be uploaded to the agent",
          "Must be excluded from the agent",
          "Are not supported"
        ]
      },
      {
        "id": "stmt_2",
        "statement": "AI general knowledge:",
        "options": [
          "Must be enabled for the agent",
          "Must be disabled for the agent",
          "Is not supported"
        ]
      }
    ],
    "correct_answer": {
      "stmt_1": "Must be uploaded to the agent",
      "stmt_2": "Must be enabled for the agent"
    }
  },
  "20": {
    "question_type": "hotspot",
    "question_text": "A company plans to implement application lifecycle management (ALM) for Copilot Studio and Microsoft Foundry agents. You need to recommend ALM tools for each platform.",
    "answer_options": [
      {
        "id": "stmt_1",
        "statement": "Copilot Studio:",
        "options": [
          "Export from the source code repository and import to the target environment.",
          "Use a Bicep file.",
          "Use a Microsoft Power Platform deployment pipeline."
        ]
      },
      {
        "id": "stmt_2",
        "statement": "Microsoft Foundry:",
        "options": [
          "Use a Bicep file.",
          "Use a Microsoft Power Platform deployment pipeline.",
          "Use an Azure DevOps pipeline."
        ]
      }
    ],
    "correct_answer": {
      "stmt_1": "Use a Microsoft Power Platform deployment pipeline.",
      "stmt_2": "Use a Bicep file."
    }
  },
  "21": {
    "question_type": "hotspot",
    "question_text": "A company has a Microsoft Copilot Studio agent. You need to identify which metrics to use in Copilot Studio analytics to measure agent performance. What should you identify for each requirement?",
    "answer_options": [
      {
        "id": "stmt_1",
        "statement": "Provides effective and relevant responses:",
        "options": [
          "Generated answer rate and quality",
          "Reactions",
          "Tool use"
        ]
      },
      {
        "id": "stmt_2",
        "statement": "Provides conversational outcomes:",
        "options": [
          "Satisfaction",
          "Tool use",
          "Topics by outcome"
        ]
      }
    ],
    "correct_answer": {
      "stmt_1": "Generated answer rate and quality",
      "stmt_2": "Satisfaction"
    }
  },
  "23": {
    "question_type": "hotspot",
    "question_text": "You are designing a testing solution for an enterprise application that uses Dynamics 365 Sales and Dynamics 365 Finance. You need to identify test scenarios and metrics to validate cross-app functionality.",
    "answer_options": [
      {
        "id": "stmt_1",
        "statement": "Test scenario:",
        "options": [
          "In each app, test isolated tasks without using workflows.",
          "Run task-based scenarios that involve both apps.",
          "Test visual consistency across both apps."
        ]
      },
      {
        "id": "stmt_2",
        "statement": "Metric:",
        "options": [
          "Measure the initial prompt response time for each app.",
          "Track the average click rate across both apps.",
          "Track the successful completion of cross-app tasks."
        ]
      }
    ],
    "correct_answer": {
      "stmt_1": "Run task-based scenarios that involve both apps.",
      "stmt_2": "Track the successful completion of cross-app tasks."
    }
  },
  "25": {
    "question_type": "matching",
    "question_text": "A company has an AI solution that includes Microsoft Copilot Studio agents. You need to recommend tools to monitor the solution. What should you recommend for each requirement?",
    "answer_options": {
      "source_title": "Options",
      "target_title": "Requirements / Answer Area",
      "sources": [
        {
          "id": "src_1",
          "text": "Application Insights"
        },
        {
          "id": "src_2",
          "text": "Copilot Studio"
        },
        {
          "id": "src_3",
          "text": "Log Analytics"
        },
        {
          "id": "src_4",
          "text": "Microsoft Power Apps"
        }
      ],
      "targets": [
        {
          "id": "tgt_1",
          "text": "Monitor the agent's telemetry in NRT:",
          "correct_source_id": "src_1"
        },
        {
          "id": "tgt_2",
          "text": "Download transcripts of full conversations:",
          "correct_source_id": "src_2"
        },
        {
          "id": "tgt_3",
          "text": "Monitor the agent's usage and performance:",
          "correct_source_id": "src_2"
        }
      ],
      "pairs": [
        {
          "source_id": "src_1",
          "target_id": "tgt_1"
        },
        {
          "source_id": "src_2",
          "target_id": "tgt_2"
        },
        {
          "source_id": "src_2",
          "target_id": "tgt_3"
        }
      ]
    },
    "correct_answer": {
      "tgt_1": "src_1",
      "tgt_2": "src_2",
      "tgt_3": "src_2"
    }
  },
  "26": {
    "question_type": "hotspot",
    "question_text": "A company deploys a Microsoft Copilot Studio agent that invokes a Power Automate for desktop flow. You need to validate the agent and the flow before release.",
    "answer_options": [
      {
        "id": "stmt_1",
        "statement": "Validate the most recent changes to the agent before release:",
        "options": [
          "Publish the agent to a channel and test the agent on live users.",
          "Run tests against the latest unpublished version of the agent.",
          "Run tests against the production version of the agent."
        ]
      },
      {
        "id": "stmt_2",
        "statement": "Validate the flow as part of the agent's orchestration:",
        "options": [
          "Add the flow to the agent as a tool.",
          "Add the flow to a canvas app.",
          "Use the Power Automate for desktop console."
        ]
      }
    ],
    "correct_answer": {
      "stmt_1": "Run tests against the latest unpublished version of the agent.",
      "stmt_2": "Use the Power Automate for desktop console."
    }
  },
  "29": {
    "question_type": "hotspot",
    "question_text": "A company deploys agents that run across multiple Azure regions. You need to configure Azure governance tools to enforce region policies and verify compliance.",
    "answer_options": [
      {
        "id": "stmt_1",
        "statement": "Enforces the deployment of the resources to only approved regions:",
        "options": [
          "Azure Monitor",
          "Azure Policy",
          "Microsoft Defender for Cloud",
          "Microsoft Purview",
          "Microsoft Sentinel"
        ]
      },
      {
        "id": "stmt_2",
        "statement": "Provides continuous compliance verification of the resources:",
        "options": [
          "Azure Monitor",
          "Azure Policy",
          "Microsoft Defender for Cloud",
          "Microsoft Purview",
          "Microsoft Sentinel"
        ]
      }
    ],
    "correct_answer": {
      "stmt_1": "Azure Policy",
      "stmt_2": "Microsoft Purview"
    }
  },
  "31": {
    "question_type": "hotspot",
    "question_text": "A company uses Azure OpenAI models and grounding data in Microsoft Azure. You need to configure security controls to restrict grounding data access and model fine-tuning.",
    "answer_options": [
      {
        "id": "stmt_1",
        "statement": "Restricts access to the grounding data:",
        "options": [
          "Azure AI Content Safety",
          "Azure Monitor alerts",
          "Azure Policy compliance rules",
          "Microsoft Purview access policies"
        ]
      },
      {
        "id": "stmt_2",
        "statement": "Restricts model fine-tuning:",
        "options": [
          "Azure Policy compliance rules",
          "Azure Resource Manager (ARM) resource locks",
          "Microsoft Entra Conditional Access",
          "Role-based access control (RBAC) in Microsoft Foundry"
        ]
      }
    ],
    "correct_answer": {
      "stmt_1": "Microsoft Purview access policies",
      "stmt_2": "Role-based access control (RBAC) in Microsoft Foundry"
    }
  },
  "32": {
    "question_type": "matching",
    "question_text": "A company has a Microsoft Copilot Studio agent. You need to identify which insights to use in Copilot Studio analytics to evaluate unanswered questions and abandoned sessions.",
    "answer_options": {
      "source_title": "Insights",
      "target_title": "Answer Area",
      "sources": [
        {
          "id": "src_1",
          "text": "Conversation outcomes"
        },
        {
          "id": "src_2",
          "text": "Generated answer rate and quality"
        },
        {
          "id": "src_3",
          "text": "Reactions"
        },
        {
          "id": "src_4",
          "text": "Survey results"
        }
      ],
      "targets": [
        {
          "id": "tgt_1",
          "text": "The number of unanswered questions:",
          "correct_source_id": "src_2"
        },
        {
          "id": "tgt_2",
          "text": "The number of abandoned sessions:",
          "correct_source_id": "src_1"
        }
      ],
      "pairs": [
        {
          "source_id": "src_2",
          "target_id": "tgt_1"
        },
        {
          "source_id": "src_1",
          "target_id": "tgt_2"
        }
      ]
    },
    "correct_answer": {
      "tgt_1": "src_2",
      "tgt_2": "src_1"
    }
  },
  "41": {
    "question_type": "matching",
    "question_text": "You are designing two Microsoft Copilot Studio agents named Agent1 and Agent2. Each agent must meet the following requirements:\n- Each agent must use a standard model.\n- Each agent must NOT use generative orchestration.\n- Agent1 must support simple and short phrases for a given topic.\n- Agent2 must integrate with Microsoft Dynamics 365 Contact Center voice channel.\n\nYou need to recommend language models for the agents. What should you recommend for each agent?",
    "answer_options": {
      "source_title": "Options",
      "target_title": "Requirements / Answer Area",
      "sources": [
        {
          "id": "src_1",
          "text": "Azure Language in Foundry Tools"
        },
        {
          "id": "src_2",
          "text": "Azure OpenAI"
        },
        {
          "id": "src_3",
          "text": "Conversational language understanding (CLU)"
        },
        {
          "id": "src_4",
          "text": "Natural Language Understanding (NLU)"
        },
        {
          "id": "src_5",
          "text": "Natural Language Understanding + (NLU +)"
        }
      ],
      "targets": [
        {
          "id": "tgt_1",
          "text": "Agent1 must support simple and short phrases for a given topic:",
          "correct_source_id": "src_4"
        },
        {
          "id": "tgt_2",
          "text": "Agent2 must integrate with Microsoft Dynamics 365 Contact Center voice channel:",
          "correct_source_id": "src_5"
        }
      ],
      "pairs": [
        {
          "source_id": "src_4",
          "target_id": "tgt_1"
        },
        {
          "source_id": "src_5",
          "target_id": "tgt_2"
        }
      ]
    },
    "correct_answer": {
      "tgt_1": "src_4",
      "tgt_2": "src_5"
    }
  },
  "44": {
    "question_type": "hotspot",
    "question_text": "You need to design a shared prompt repository for an organization. You need to recommend solutions to ensure consistent AI responses and support governance and version control.",
    "answer_options": [
      {
        "id": "stmt_1",
        "statement": "Ensure consistent AI responses:",
        "options": [
          "Delegate department-specific prompt templates.",
          "Define standardized prompt templates.",
          "Maintain a prompt history."
        ]
      },
      {
        "id": "stmt_2",
        "statement": "Support governance and version control:",
        "options": [
          "Define standardized prompt templates.",
          "Store prompts in a Git repository.",
          "Categorize prompts by business function."
        ]
      }
    ],
    "correct_answer": {
      "stmt_1": "Define standardized prompt templates.",
      "stmt_2": "Store prompts in a Git repository."
    }
  },
  "45": {
    "question_type": "matching",
    "question_text": "A company has a Microsoft Copilot Studio agent that is experiencing performance and accuracy degradation as more topics are added. What action should you recommend for each requirement?",
    "answer_options": {
      "source_title": "Actions",
      "target_title": "Answer Area",
      "sources": [
        {
          "id": "src_1",
          "text": "Add a prebuilt connector."
        },
        {
          "id": "src_2",
          "text": "Move to a multi-agent architecture."
        },
        {
          "id": "src_3",
          "text": "Upgrade to a larger generative AI model."
        },
        {
          "id": "src_4",
          "text": "Add a grounding data source."
        }
      ],
      "targets": [
        {
          "id": "tgt_1",
          "text": "To improve performance:",
          "correct_source_id": "src_2"
        },
        {
          "id": "tgt_2",
          "text": "To improve accuracy:",
          "correct_source_id": "src_4"
        }
      ],
      "pairs": [
        {
          "source_id": "src_2",
          "target_id": "tgt_1"
        },
        {
          "source_id": "src_4",
          "target_id": "tgt_2"
        }
      ]
    },
    "correct_answer": {
      "tgt_1": "src_2",
      "tgt_2": "src_4"
    }
  },
  "50": {
    "question_type": "hotspot",
    "question_text": "You need to design a multi-agent system that includes a supervisor agent and specialized worker agents. What should you use for each requirement?",
    "answer_options": [
      {
        "id": "stmt_1",
        "statement": "Define rules and constraints:",
        "options": [
          "Agent flows",
          "Conversation topics",
          "Microsoft Power Automate cloud flow"
        ]
      },
      {
        "id": "stmt_2",
        "statement": "Automate a backend process:",
        "options": [
          "Conversation topics",
          "Microsoft Power Automate cloud flow",
          "Microsoft Power Pages"
        ]
      }
    ],
    "correct_answer": {
      "stmt_1": "Conversation topics",
      "stmt_2": "Microsoft Power Automate cloud flow"
    }
  },
  "88": {
    "question_type": "hotspot",
    "question_text": "You need to recommend a Microsoft service for each requirement. What should you recommend?",
    "answer_options": [
      {
        "id": "stmt_1",
        "statement": "Use a centralized workspace:",
        "options": [
          "An Microsoft Foundry hub",
          "Azure OpenAI Foundry",
          "Microsoft Copilot Studio",
          "Microsoft Dataverse"
        ]
      },
      {
        "id": "stmt_2",
        "statement": "Generate short overviews:",
        "options": [
          "An AI Builder prebuilt model",
          "An AI Builder prebuilt prompt",
          "Azure OpenAI",
          "GitHub Copilot",
          "Microsoft Copilot in Power Automate"
        ]
      }
    ],
    "correct_answer": {
      "stmt_1": "Azure OpenAI Foundry",
      "stmt_2": "An AI Builder prebuilt prompt"
    }
  },
  "90": {
    "question_type": "matching",
    "question_text": "A company has a cloud-based AI solution that uses Azure OpenAI models. You need to design a monitoring solution that meets the requirements: Monitors AI app and agents for compliance, Monitors performance metrics and operational health. What should you use for each requirement?",
    "answer_options": {
      "source_title": "Options",
      "target_title": "Answer Area",
      "sources": [
        {
          "id": "src_1",
          "text": "Azure API Management"
        },
        {
          "id": "src_2",
          "text": "Azure Policy"
        },
        {
          "id": "src_3",
          "text": "Microsoft Defender"
        },
        {
          "id": "src_4",
          "text": "Azure Monitor"
        },
        {
          "id": "src_5",
          "text": "Azure Stream Analytics"
        },
        {
          "id": "src_6",
          "text": "Microsoft Purview"
        }
      ],
      "targets": [
        {
          "id": "tgt_1",
          "text": "Monitors AI app and agents for compliance:",
          "correct_source_id": "src_6"
        },
        {
          "id": "tgt_2",
          "text": "Monitors performance metrics and operational health:",
          "correct_source_id": "src_4"
        }
      ],
      "pairs": [
        {
          "source_id": "src_6",
          "target_id": "tgt_1"
        },
        {
          "source_id": "src_4",
          "target_id": "tgt_2"
        }
      ]
    },
    "correct_answer": {
      "tgt_1": "src_6",
      "tgt_2": "src_4"
    }
  },
  "91": {
    "question_type": "hotspot",
    "question_text": "You use Microsoft Copilot Studio analytics to analyze the performance of a deployed Copilot Studio agent. You need to identify which performance metrics to use for escalated sessions and knowledge source errors.",
    "answer_options": [
      {
        "id": "stmt_1",
        "statement": "The percentage of engaged sessions that are escalated to a representative:",
        "options": [
          "Answer quality",
          "Customer Satisfaction (CSAT) score",
          "Engagement rate",
          "Escalation rate"
        ]
      },
      {
        "id": "stmt_2",
        "statement": "The number of agent queries that cause a knowledge source error:",
        "options": [
          "Answer quality",
          "Engagement rate",
          "Escalation rate"
        ]
      }
    ],
    "correct_answer": {
      "stmt_1": "Escalation rate",
      "stmt_2": "Answer quality"
    }
  },
  "92": {
    "question_type": "hotspot",
    "question_text": "You are designing a testing solution for Microsoft Copilot Studio agents. You need to validate prompt engineering best practices to ensure that the agents generate accurate and contextually relevant responses.",
    "answer_options": [
      {
        "id": "stmt_1",
        "statement": "Prompt validation techniques:",
        "options": [
          "Exclude domain-specific terminology from the prompts.",
          "Use prompts that have varied phrasing",
          "Use only simple, one-word prompts."
        ]
      },
      {
        "id": "stmt_2",
        "statement": "Metrics:",
        "options": [
          "The number of words generated per response",
          "Response relevance and accuracy",
          "The response generation time"
        ]
      }
    ],
    "correct_answer": {
      "stmt_1": "Use prompts that have varied phrasing",
      "stmt_2": "Response relevance and accuracy"
    }
  },
  "93": {
    "question_type": "matching",
    "question_text": "A company has a cloud-based AI solution that uses Azure OpenAI models. You need to design a monitoring solution that meets the following requirements:\n- Monitors performance metrics and operational health for the models\n- Monitors AI apps and agents for compliance\n- Uses Azure-native capabilities\n- Minimizes development effort\n\nWhat should you use for each requirement?",
    "answer_options": {
      "source_title": "Options",
      "target_title": "Answer Area",
      "sources": [
        {
          "id": "src_1",
          "text": "Azure API Management"
        },
        {
          "id": "src_2",
          "text": "Azure Monitor"
        },
        {
          "id": "src_3",
          "text": "Azure Policy"
        },
        {
          "id": "src_4",
          "text": "Azure Stream Analytics"
        },
        {
          "id": "src_5",
          "text": "Microsoft Defender"
        },
        {
          "id": "src_6",
          "text": "Microsoft Purview"
        }
      ],
      "targets": [
        {
          "id": "tgt_1",
          "text": "Monitors AI app and agents for compliance:",
          "correct_source_id": "src_6"
        },
        {
          "id": "tgt_2",
          "text": "Monitors performance metrics and operational health:",
          "correct_source_id": "src_2"
        }
      ],
      "pairs": [
        {
          "source_id": "src_6",
          "target_id": "tgt_1"
        },
        {
          "source_id": "src_2",
          "target_id": "tgt_2"
        }
      ]
    },
    "correct_answer": {
      "tgt_1": "src_6",
      "tgt_2": "src_2"
    }
  },
  "94": {
    "question_type": "hotspot",
    "question_text": "A company has a Microsoft Copilot Studio agent for customer support. You are reviewing and validating the following prompts:\n- A prompt that has instructions to \"help the customer as best you can\"\n- A prompt that helps retrieve product information from a knowledge base\n\nYou need to ensure that the agent delivers consistent and accurate responses. What should you do for each prompt?",
    "answer_options": [
      {
        "id": "stmt_1",
        "statement": "A prompt that has instructions to \"help the customer as best you can\":",
        "options": [
          "Add filler words to make the prompt sound more natural and conversational.",
          "Keep the prompt vague to enable model flexibility.",
          "Rewrite the prompt with clear and task-specific instructions."
        ]
      },
      {
        "id": "stmt_2",
        "statement": "A prompt that helps retrieve product information from a knowledge base:",
        "options": [
          "Add several open-ended questions to give the model broader context.",
          "Use responses with only reference sources and limit the response scope.",
          "Remove the knowledge source so that the model responds freely with general product information."
        ]
      }
    ],
    "correct_answer": {
      "stmt_1": "Rewrite the prompt with clear and task-specific instructions.",
      "stmt_2": "Use responses with only reference sources and limit the response scope."
    }
  },
  "96": {
    "question_type": "hotspot",
    "question_text": "You use Microsoft Copilot Studio analytics to analyze the performance of a deployed Copilot Studio agent. You need to identify which performance metrics to use to measure the following:\n- The percentage of engaged sessions that are escalated to a live customer service representative\n- The number of agent queries that cause a knowledge source error\n\nWhat should you identify for each requirement?",
    "answer_options": [
      {
        "id": "stmt_1",
        "statement": "The percentage of engaged sessions that are escalated to a representative:",
        "options": [
          "Answer quality",
          "Customer Satisfaction (CSAT) score",
          "Engagement rate",
          "Escalation rate"
        ]
      },
      {
        "id": "stmt_2",
        "statement": "The number of agent queries that cause a knowledge source error:",
        "options": [
          "Answer quality",
          "Engagement rate",
          "Escalation rate"
        ]
      }
    ],
    "correct_answer": {
      "stmt_1": "Escalation rate",
      "stmt_2": "Answer quality"
    }
  },
  "97": {
    "question_type": "matching",
    "question_text": "You are designing end-to-end test scenarios for a business solution that uses Microsoft Dynamics 365 Sales and Dynamics 365 Finance. You need to ensure that the business solution meets the following test requirements:\n- Properly exchanges data between the Dynamics 365 apps\n- Aligns with defined user workflows and business processes\n\nWhich type of testing should you use for each requirement?",
    "answer_options": {
      "source_title": "Testing types",
      "target_title": "Answer Area",
      "sources": [
        {
          "id": "src_1",
          "text": "Drift"
        },
        {
          "id": "src_2",
          "text": "Exploratory"
        },
        {
          "id": "src_3",
          "text": "Integration"
        },
        {
          "id": "src_4",
          "text": "Performance"
        },
        {
          "id": "src_5",
          "text": "User acceptance"
        }
      ],
      "targets": [
        {
          "id": "tgt_1",
          "text": "Properly exchanges data between the Dynamics 365 apps:",
          "correct_source_id": "src_3"
        },
        {
          "id": "tgt_2",
          "text": "Aligns with defined user workflows and business processes:",
          "correct_source_id": "src_5"
        }
      ],
      "pairs": [
        {
          "source_id": "src_3",
          "target_id": "tgt_1"
        },
        {
          "source_id": "src_5",
          "target_id": "tgt_2"
        }
      ]
    },
    "correct_answer": {
      "tgt_1": "src_3",
      "tgt_2": "src_5"
    }
  },
  "99": {
    "question_type": "hotspot",
    "question_text": "A company has a Microsoft Copilot Studio agent for customer support. You are reviewing and validating the following prompts:\n- A prompt that has instructions to \"help the customer as best you can\"\n- A prompt that helps retrieve product information from a knowledge base\n\nYou need to ensure that the agent delivers consistent and accurate responses. What should you do for each prompt?",
    "answer_options": [
      {
        "id": "stmt_1",
        "statement": "A prompt that has instructions to \"help the customer as best you can\":",
        "options": [
          "Add filler words to make the prompt sound more natural and conversational.",
          "Keep the prompt vague to enable model flexibility.",
          "Rewrite the prompt with clear and task-specific instructions."
        ]
      },
      {
        "id": "stmt_2",
        "statement": "A prompt that helps retrieve product information from a knowledge base:",
        "options": [
          "Add several open-ended questions to give the model broader context.",
          "Use responses with only reference sources and limit the response scope.",
          "Remove the knowledge source so that the model responds freely with general product information."
        ]
      }
    ],
    "correct_answer": {
      "stmt_1": "Rewrite the prompt with clear and task-specific instructions.",
      "stmt_2": "Use responses with only reference sources and limit the response scope."
    }
  },
  "100": {
    "question_type": "hotspot",
    "question_text": "You are designing a testing solution for Microsoft Copilot Studio agents. You need to validate prompt engineering best practices to ensure that the agents generate accurate and contextually relevant responses. Which prompt validation techniques and metrics should you include in the solution?",
    "answer_options": [
      {
        "id": "stmt_1",
        "statement": "Prompt validation techniques:",
        "options": [
          "Exclude domain-specific terminology from the prompts.",
          "Use prompts that have varied phrasing.",
          "Use only simple, one-word prompts."
        ]
      },
      {
        "id": "stmt_2",
        "statement": "Metrics:",
        "options": [
          "The number of words generated per response",
          "Response relevance and accuracy",
          "The response generation time"
        ]
      }
    ],
    "correct_answer": {
      "stmt_1": "Use prompts that have varied phrasing.",
      "stmt_2": "Response relevance and accuracy"
    }
  },
  "106": {
    "question_type": "matching",
    "question_text": "A company plans to implement agents in Microsoft Copilot Studio. You need to recommend agent types for sales order processing and historical data analysis. What should you recommend for each requirement?",
    "answer_options": {
      "source_title": "Agent types",
      "target_title": "Answer Area",
      "sources": [
        {
          "id": "src_1",
          "text": "Autonomous"
        },
        {
          "id": "src_2",
          "text": "Prompt-and-response"
        },
        {
          "id": "src_3",
          "text": "Task"
        }
      ],
      "targets": [
        {
          "id": "tgt_1",
          "text": "Orchestrate the sales order fulfillment and shipping:",
          "correct_source_id": "src_1"
        },
        {
          "id": "tgt_2",
          "text": "Analyze historical data and trends:",
          "correct_source_id": "src_3"
        }
      ],
      "pairs": [
        {
          "source_id": "src_1",
          "target_id": "tgt_1"
        },
        {
          "source_id": "src_3",
          "target_id": "tgt_2"
        }
      ]
    },
    "correct_answer": {
      "tgt_1": "src_1",
      "tgt_2": "src_3"
    }
  },
  "109": {
    "question_type": "hotspot",
    "question_text": "A company has a Microsoft Power Platform environment. You need to recommend tools to build agents for specific business scenarios. What should you recommend for each agent?",
    "answer_options": [
      {
        "id": "stmt_1",
        "statement": "Agent1:",
        "options": [
          "Microsoft Foundry",
          "Azure Logic Apps",
          "Copilot in Power Apps",
          "Microsoft Copilot Studio"
        ]
      },
      {
        "id": "stmt_2",
        "statement": "Agent2:",
        "options": [
          "Microsoft Foundry",
          "Azure Logic Apps",
          "Copilot in Power Apps",
          "Microsoft Copilot Studio"
        ]
      }
    ],
    "correct_answer": {
      "stmt_1": "Microsoft Foundry",
      "stmt_2": "Copilot in Power Apps"
    }
  },
  "111": {
    "question_type": "hotspot",
    "question_text": "You need to recommend a Microsoft service for each requirement. What should you recommend?",
    "answer_options": [
      {
        "id": "stmt_1",
        "statement": "Use a centralized workspace:",
        "options": [
          "An Microsoft Foundry hub",
          "Azure OpenAI Foundry",
          "Microsoft Copilot Studio",
          "Microsoft Dataverse"
        ]
      },
      {
        "id": "stmt_2",
        "statement": "Generate short overviews:",
        "options": [
          "An AI Builder prebuilt model",
          "An AI Builder prebuilt prompt",
          "Azure OpenAI",
          "GitHub Copilot",
          "Microsoft Copilot in Power Automate"
        ]
      }
    ],
    "correct_answer": {
      "stmt_1": "Azure OpenAI Foundry",
      "stmt_2": "An AI Builder prebuilt model"
    }
  },
  "112": {
    "question_type": "hotspot",
    "question_text": "A company uses Microsoft Dynamics 365 Finance for accounts payable and customer debt recovery. You are designing an AI finance process. What should you recommend for each requirement?",
    "answer_options": [
      {
        "id": "stmt_1",
        "statement": "Help identify vendor overdue invoices and outstanding balances:",
        "options": [
          "Agent management",
          "AI Summaries with Copilot",
          "The Account Reconciliation agent",
          "The Supplier Communication agent"
        ]
      },
      {
        "id": "stmt_2",
        "statement": "Reduce how long it takes to review overdue invoices and payment history:",
        "options": [
          "Analyze demand plans with Copilot",
          "Collections coordinator summary",
          "The Account Reconciliation agent",
          "The Supplier Communication agent"
        ]
      }
    ],
    "correct_answer": {
      "stmt_1": "AI Summaries with Copilot",
      "stmt_2": "Collections coordinator summary"
    }
  },
  "117": {
    "question_type": "matching",
    "question_text": "A company has an ecommerce support portal that uses Microsoft Dataverse. You are designing a Microsoft Copilot Studio agent for the portal. The agent must meet the following requirements:\n- Respond with a default help message when the user input is unclear.\n- Initiate external processes, such as retrieving the order status, when users make specific requests.\n\nGenerative orchestration will be enabled for the solution. You need to recommend a feature for each requirement. What should you recommend?",
    "answer_options": {
      "source_title": "Options",
      "target_title": "Requirements / Answer Area",
      "sources": [
        {
          "id": "src_1",
          "text": "A tool (connector)"
        },
        {
          "id": "src_2",
          "text": "A trigger phrase"
        },
        {
          "id": "src_3",
          "text": "The Fallback topic"
        },
        {
          "id": "src_4",
          "text": "A skill"
        },
        {
          "id": "src_5",
          "text": "The Escalate topic"
        }
      ],
      "targets": [
        {
          "id": "tgt_1",
          "text": "Respond with a default help message when the user input is unclear:",
          "correct_source_id": "src_3"
        },
        {
          "id": "tgt_2",
          "text": "Initiate external processes when requested:",
          "correct_source_id": "src_1"
        }
      ],
      "pairs": [
        {
          "source_id": "src_3",
          "target_id": "tgt_1"
        },
        {
          "source_id": "src_1",
          "target_id": "tgt_2"
        }
      ]
    },
    "correct_answer": {
      "tgt_1": "src_3",
      "tgt_2": "src_1"
    }
  },
  "124": {
    "question_type": "hotspot",
    "question_text": "A company has Microsoft Power Platform development, staging, and production environments. Each environment has its own Microsoft Dataverse tables and Azure AI Search index. You are designing an application lifecycle management (ALM) process to deploy a Microsoft Copilot Studio agent between the environments. The company has a Copilot Studio agent named Agent1 in development. Agent1 uses the following grounding data sources:\n- A Dataverse table named CustomerOrders\n- An Azure AI Search index named customer-knowledge\n\nYou need to deploy Agent1 to production. The solution must ensure that the agent uses the production grounding data sources, minimizes downtime, and handles credentials and endpoints securely. What should you include in the deployment package solution, and what should you reconfigure after the deployment?",
    "answer_options": [
      {
        "id": "stmt_1",
        "statement": "Include in the deployment package solution:",
        "options": [
          "Agent1 only",
          "The data sources only",
          "Agent1 and the data source connections",
          "Agent1 and references to the data sources",
          "Agent1, the data sources, and the data source connections"
        ]
      },
      {
        "id": "stmt_2",
        "statement": "Reconfigure after the deployment:",
        "options": [
          "The Dataverse connection only",
          "The Azure AI Search connection only",
          "The Dataverse and Azure AI Search connections",
          "The Agent1 configuration",
          "The environment variables"
        ]
      }
    ],
    "correct_answer": {
      "stmt_1": "Agent1 and references to the data sources",
      "stmt_2": "The environment variables"
    }
  },
  "130": {
    "question_type": "hotspot",
    "question_text": "What should you include in the custom AI agent design to meet the R&D product specifications and the compliance information requirements?",
    "answer_options": [
      {
        "id": "stmt_1",
        "statement": "To expose the data to the agent, create:",
        "options": [
          "an Azure AI Bot Service channel",
          "a custom connector",
          "a custom OData entity",
          "the Semantic Kernel"
        ]
      },
      {
        "id": "stmt_2",
        "statement": "Add to the agent:",
        "options": [
          "an event trigger",
          "the MCP server",
          "a REST API",
          "a tool"
        ]
      }
    ],
    "correct_answer": {
      "stmt_1": "a custom connector",
      "stmt_2": "a tool"
    }
  },
  "131": {
    "question_type": "matching",
    "question_text": "Which tools should you recommend to assist the CISO and the CIO with their specific responsibilities?",
    "answer_options": {
      "source_title": "Tools",
      "target_title": "Answer Area",
      "sources": [
        {
          "id": "src_1",
          "text": "Azure Blob Storage"
        },
        {
          "id": "src_2",
          "text": "Azure Resource Graph Explorer"
        },
        {
          "id": "src_3",
          "text": "Copilot Studio"
        },
        {
          "id": "src_4",
          "text": "Microsoft Purview"
        }
      ],
      "targets": [
        {
          "id": "tgt_1",
          "text": "CISO:",
          "correct_source_id": "src_4"
        },
        {
          "id": "tgt_2",
          "text": "CIO:",
          "correct_source_id": "src_4"
        }
      ],
      "pairs": [
        {
          "source_id": "src_4",
          "target_id": "tgt_1"
        },
        {
          "source_id": "src_4",
          "target_id": "tgt_2"
        }
      ]
    },
    "correct_answer": {
      "tgt_1": "src_4",
      "tgt_2": "src_4"
    }
  },
  "132": {
    "question_type": "matching",
    "question_text": "Which Copilot Studio analytics metrics should you recommend to assist the executives with their specific responsibilities?",
    "answer_options": {
      "source_title": "Metrics",
      "target_title": "Answer Area",
      "sources": [
        {
          "id": "src_1",
          "text": "Effectiveness"
        },
        {
          "id": "src_2",
          "text": "Tool use"
        },
        {
          "id": "src_3",
          "text": "Satisfaction"
        },
        {
          "id": "src_4",
          "text": "Use"
        }
      ],
      "targets": [
        {
          "id": "tgt_1",
          "text": "CFO concerns about Copilot Studio credit usage:",
          "correct_source_id": "src_1"
        },
        {
          "id": "tgt_2",
          "text": "CTO concerns about poor feedback on AI agent responses:",
          "correct_source_id": "src_3"
        }
      ],
      "pairs": [
        {
          "source_id": "src_1",
          "target_id": "tgt_1"
        },
        {
          "source_id": "src_3",
          "target_id": "tgt_2"
        }
      ]
    },
    "correct_answer": {
      "tgt_1": "src_1",
      "tgt_2": "src_3"
    }
  },
  "1": {
    "question_type": "case_study",
    "question_text": "Which framework should you use for the infrastructure migration?",
    "answer_options": [
      {
        "id": "A",
        "text": "Microsoft Cloud Adoption Framework for Azure"
      },
      {
        "id": "B",
        "text": "Success by Design"
      },
      {
        "id": "C",
        "text": "Microsoft Power Platform Center of Excellence (CoE)"
      },
      {
        "id": "D",
        "text": "Microsoft Power Platform Project Setup Wizard"
      }
    ],
    "correct_answer": "A"
  },
  "2": {
    "question_type": "case_study",
    "question_text": "Which template should you use for the AI agent to meet the requirements for the sales executives?",
    "answer_options": [
      {
        "id": "A",
        "text": "IT Helpdesk in Microsoft Copilot Studio"
      },
      {
        "id": "B",
        "text": "AI agents in Microsoft Foundry"
      },
      {
        "id": "C",
        "text": "Voice in Microsoft Copilot Studio"
      },
      {
        "id": "D",
        "text": "AI chat in Microsoft Foundry"
      }
    ],
    "correct_answer": "C"
  },
  "3": {
    "question_type": "case_study",
    "question_text": "Which tool should you use for the prospect communication requirements in Dynamics 365 Sales?",
    "answer_options": [
      {
        "id": "A",
        "text": "Azure AI Search"
      },
      {
        "id": "B",
        "text": "Copilot email assist"
      },
      {
        "id": "C",
        "text": "the Voice template Microsoft Copilot Studio"
      },
      {
        "id": "D",
        "text": "Deep Research in Microsoft Foundry Agent Service"
      }
    ],
    "correct_answer": "B"
  },
  "4": {
    "question_type": "case_study",
    "question_text": "Which tool should you recommend to address the sensitive information concerns in the sales process?",
    "answer_options": [
      {
        "id": "A",
        "text": "the Analytics tab in Microsoft Copilot Studio"
      },
      {
        "id": "B",
        "text": "Model Context Protocol (MCP)"
      },
      {
        "id": "C",
        "text": "Application Insights"
      },
      {
        "id": "D",
        "text": "Microsoft Foundry Tracing UI"
      }
    ],
    "correct_answer": "D"
  },
  "5": {
    "question_type": "case_study",
    "question_text": "Which tool should you recommend to help secure funding for future AI agent development?",
    "answer_options": [
      {
        "id": "A",
        "text": "Evaluations in Microsoft Foundry"
      },
      {
        "id": "B",
        "text": "the Azure Cost Optimization workbook"
      },
      {
        "id": "C",
        "text": "Azure Operator Insights"
      },
      {
        "id": "D",
        "text": "the Analytics tab in Microsoft Copilot Studio"
      }
    ],
    "correct_answer": "D"
  },
  "127": {
    "question_type": "multiple_response",
    "question_text": "Which two components in the custom AI agent design should the CFO evaluate in the quarterly agent analysis? Each correct answer presents part of the solution.",
    "answer_options": [
      {
        "id": "A",
        "text": "the GPT models used for the agent"
      },
      {
        "id": "B",
        "text": "the average characters in a chat message"
      },
      {
        "id": "C",
        "text": "the agent orchestration method"
      },
      {
        "id": "D",
        "text": "the average session time per agent"
      }
    ],
    "correct_answer": [
      "C",
      "D"
    ],
    "required_selection_count": 2,
    "partial_credit": true
  },
  "128": {
    "question_type": "case_study",
    "question_text": "What should you configure for the custom AI agent?",
    "answer_options": [
      {
        "id": "A",
        "text": "AI-assisted evaluators"
      },
      {
        "id": "B",
        "text": "classic orchestration"
      },
      {
        "id": "C",
        "text": "generative orchestration"
      },
      {
        "id": "D",
        "text": "Azure OpenAI reasoning models"
      }
    ],
    "correct_answer": "C"
  },
  "129": {
    "question_type": "case_study",
    "question_text": "What should you recommend to assist the CTO with the prebuilt agent selection process?",
    "answer_options": [
      {
        "id": "A",
        "text": "Agent management"
      },
      {
        "id": "B",
        "text": "Copilot Studio"
      },
      {
        "id": "C",
        "text": "Lifecycle Services (LCS)"
      },
      {
        "id": "D",
        "text": "Immersive Home"
      }
    ],
    "correct_answer": "A"
  },
  "133": {
    "question_type": "multiple_response",
    "question_text": "Which two components for the custom AI agent should you include in the application lifecycle management (AIM) process? Each correct answer presents part of the solution.",
    "answer_options": [
      {
        "id": "A",
        "text": "an Azure package"
      },
      {
        "id": "B",
        "text": "a ZIP package"
      },
      {
        "id": "C",
        "text": "a Microsoft Power Platform solution"
      },
      {
        "id": "D",
        "text": "a Cloud Scale Unit (CSU) package"
      }
    ],
    "correct_answer": [
      "B",
      "C"
    ],
    "required_selection_count": 2,
    "partial_credit": true
  },
  "134": {
    "question_type": "case_study",
    "question_text": "What should you recommend to assist the CEO with their specific responsibilities?",
    "answer_options": [
      {
        "id": "A",
        "text": "the Microsoft Service Trust Portal"
      },
      {
        "id": "B",
        "text": "Microsoft Foundry Tools"
      },
      {
        "id": "C",
        "text": "Microsoft Purview"
      },
      {
        "id": "D",
        "text": "the Responsible AI dashboard"
      }
    ],
    "correct_answer": "D"
  }
};

function cleanLine(line) {
  let l = line.trim();
  if (/Get\s+Latest\s+&\s+Actual\s+.*Exam/i.test(l) || /passleader\.com/i.test(l)) return '';
  if (/^\d+$/.test(l)) return ''; // page number alone
  return line;
}

function sanitizePrompt(raw) {
  if (!raw) return '';
  let p = raw
    .replace(/^QUESTION\s+\d+\s*/i, '')
    .replace(/^(?:Drag and Drop Question|Hotspot Question)\s*/i, '')
    .replace(/^Case Study\s*\d+[^\n]*\n*/i, '')
    .replace(/\s*To answer,?\s*(?:drag|select)[\s\S]*$/i, '')
    .replace(/\s*NOTE:\s*Each correct selection is worth one point\.?[\s\S]*$/i, '')
    .trim();
  return p;
}

export async function parseExamPdfInBrowser(arrayBuffer, onProgress = () => {}) {
  // Ensure PDF.js is loaded
  if (typeof window.pdfjsLib === 'undefined') {
    throw new Error('PDF.js library is not loaded. Please refresh the page and try again.');
  }

  onProgress(5, 'Initializing PDF parser engine...');
  const pdfDoc = await window.pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const numPages = pdfDoc.numPages;

  onProgress(10, `Reading ${numPages} PDF pages...`);

  let fullText = '';
  let examInfo = {
    vendor: 'Microsoft',
    code: 'EXAM',
    title: 'Certification Exam Dump'
  };

  // Extract text page by page with line awareness
  for (let p = 1; p <= numPages; p++) {
    const page = await pdfDoc.getPage(p);
    const content = await page.getTextContent();
    let lastY = null;
    let pageLines = [];
    let currentLine = '';

    for (const item of content.items) {
      const y = item.transform ? Math.round(item.transform[5]) : null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 4) {
        if (currentLine.trim()) {
          const cleaned = cleanLine(currentLine);
          if (cleaned) pageLines.push(cleaned);
        }
        currentLine = item.str;
      } else {
        if (currentLine && !currentLine.endsWith(' ') && !item.str.startsWith(' ')) {
          currentLine += ' ';
        }
        currentLine += item.str;
      }
      if (y !== null) lastY = y;
    }
    if (currentLine.trim()) {
      const cleaned = cleanLine(currentLine);
      if (cleaned) pageLines.push(cleaned);
    }

    const pText = pageLines.join('\n');
    fullText += `\n<<<PAGE_${p}>>>\n` + pText;

    if (p <= 3) {
      const vMatch = pText.match(/Vendor:\s*([^\n]+)/i);
      if (vMatch) examInfo.vendor = vMatch[1].trim();
      const cMatch = pText.match(/Exam\s*Code:\s*([^\n]+)/i);
      if (cMatch) examInfo.code = cMatch[1].trim().replace(/\s+/g, '');
      const tMatch = pText.match(/Exam\s*Name:\s*([^\n]+)/i);
      if (tMatch) examInfo.title = tMatch[1].trim();
    }

    if (p % 15 === 0 || p === numPages) {
      const pct = 10 + Math.round((p / numPages) * 60);
      onProgress(pct, `Extracted page ${p} of ${numPages}...`);
    }
  }

  onProgress(75, 'Analyzing question boundaries and types...');

  // Identify QUESTION \d+ blocks
  const qMatches = [...fullText.matchAll(/QUESTION\s+(\d+)/gi)];
  if (qMatches.length === 0) {
    throw new Error('No questions found in this PDF. Please verify this is a standard certification exam dump with "QUESTION [number]" format.');
  }

  const questions = [];
  let currentCaseStudy = {
    title: '',
    background: ''
  };

  for (let i = 0; i < qMatches.length; i++) {
    const start = qMatches[i].index;
    const end = (i + 1 < qMatches.length) ? qMatches[i + 1].index : fullText.length;
    let block = fullText.substring(start, end).trim();
    const qnum = parseInt(qMatches[i][1], 10);

    // Check for Case Study header
    const csMatch = block.match(/Case\s*Study\s*(\d+)\s*-\s*([^\n]+)/i);
    if (csMatch) {
      currentCaseStudy.title = `Case Study ${csMatch[1]}: ${csMatch[2].trim()}`;
    }

    // Clean page tags out of block
    const cleanBlock = block.replace(/<<<PAGE_\d+>>>\n?/g, '');

    // Detect question type across entire block (not just first 200 chars)
    const isHotspot = /\bhotspot\s*question\b/i.test(cleanBlock);
    const isDragDrop = /\bdrag\s*and\s*drop\s*question\b/i.test(cleanBlock);
    const isCaseStudy = Boolean(csMatch) || /\bcase\s*study\b/i.test(cleanBlock);

    // Extract Answer, Explanation, Reference
    const ansMatch = cleanBlock.match(/\nAnswer:\s*([^\n]*)/i);
    const ansText = ansMatch ? ansMatch[1].trim() : '';

    let explanation = '';
    const expMatch = cleanBlock.match(/\nExplanation:\s*([\s\S]*?)(?=\nReference:|\nQUESTION\s+\d+|$)/i);
    if (expMatch) explanation = expMatch[1].trim();

    const refMatch = cleanBlock.match(/\nReference:\s*([\s\S]*?)(?=\nQUESTION\s+\d+|$)/i);
    if (refMatch) {
      const ref = refMatch[1].trim();
      explanation = explanation ? `${explanation}\n\nReference:\n${ref}` : `Reference:\n${ref}`;
    }

    const qData = {
      qnum,
      topic: examInfo.code,
      difficulty: 'medium',
      points: 1,
      question_type: 'single_choice',
      question_text: '',
      question_description: '',
      answer_options: [],
      correct_answer: '',
      answer_explanation: explanation,
      status: 'published'
    };

    const preAns = ansMatch ? cleanBlock.substring(0, ansMatch.index) : cleanBlock;
    const optMatches = [...preAns.matchAll(/\n([A-F])\.\s+([^\n]+(?:\n(?![A-F]\.|\nAnswer:)[\t ]+[^\n]+)*)/g)];

    // Handle Case Study Scenario Extraction
    if (isCaseStudy) {
      qData.question_type = 'case_study';
      const bgMatch = cleanBlock.match(/(?:Case\s*Study[\s\S]*?)?(Background|Overview)([\s\S]*?)(?=\n(?:Which|What|How|You need|Select|Hotspot|Drag and Drop|\n[A-F]\.))/i);
      if (bgMatch) {
        qData.question_description = `**${currentCaseStudy.title || 'Case Study'}**\n\n${bgMatch[1].trim()}${bgMatch[2].trim()}`;
      } else if (currentCaseStudy.title) {
        qData.question_description = `**${currentCaseStudy.title}**`;
      }
    }

    if (isHotspot || preAns.toLowerCase().includes('select the appropriate options in the answer area')) {
      qData.question_type = 'hotspot';
      const promptMatch = preAns.match(/(?:Hotspot Question\s*)?([\s\S]*?)(?=\s*To answer|\s*NOTE:|\s*Answer:)/i);
      let prompt = promptMatch ? promptMatch[1].trim() : preAns.trim();
      if (qData.question_description) {
        prompt = prompt.replace(/^Case Study[\s\S]*?(?=(?:You need|Which|What|A company|Fabrikam|An organization))/i, '').trim();
      }
      qData.question_text = sanitizePrompt(prompt) || `Question ${qnum}`;

      // Extract Boxes from explanation
      const boxes = [...explanation.matchAll(/Box\s+(\d+):\s*([^\n]+)(?:\n([^\n]+))?/g)];
      const statements = [];
      const correctKeys = {};

      if (boxes.length > 0) {
        boxes.forEach(b => {
          const boxNum = b[1];
          const correctVal = b[2].trim();
          const desc = (b[3] && b[3].trim()) ? b[3].trim() : `Requirement / Area ${boxNum}`;
          const stmtId = `stmt_${boxNum}`;
          statements.push({
            id: stmtId,
            statement: desc.toLowerCase().includes('statement') ? `${desc}: ${correctVal}` : desc,
            options: ['yes', 'no'].includes(correctVal.toLowerCase()) ? ['Yes', 'No'] : [correctVal]
          });
          correctKeys[stmtId] = correctVal;
        });
      }

      if (statements.length === 0) {
        statements.push({ id: 'stmt_1', statement: 'Select appropriate option in Answer Area', options: ['Yes', 'No'] });
        correctKeys['stmt_1'] = 'Yes';
      }

      qData.answer_options = statements;
      qData.correct_answer = correctKeys;
      qData.partial_credit = true;

    } else if (isDragDrop || preAns.toLowerCase().includes('drag the appropriate options')) {
      qData.question_type = 'matching';
      const promptMatch = preAns.match(/(?:Drag and Drop Question\s*)?([\s\S]*?)(?=\s*To answer|\s*NOTE:|\s*Answer:)/i);
      let prompt = promptMatch ? promptMatch[1].trim() : preAns.trim();
      if (qData.question_description) {
        prompt = prompt.replace(/^Case Study[\s\S]*?(?=(?:You need|Which|What|A company|Fabrikam|An organization))/i, '').trim();
      }
      qData.question_text = sanitizePrompt(prompt) || `Question ${qnum}`;

      const boxes = [...explanation.matchAll(/Box\s+(\d+):\s*([^\n]+)(?:\n([^\n]+))?/g)];
      const sources = [];
      const targets = [];
      const correctMap = {};

      if (boxes.length > 0) {
        boxes.forEach(b => {
          const boxNum = b[1];
          const srcVal = b[2].trim();
          const tgtDesc = (b[3] && b[3].trim()) ? b[3].trim() : `Target Slot #${boxNum}`;
          const srcId = `src_${boxNum}`;
          const tgtId = `tgt_${boxNum}`;
          sources.push({ id: srcId, text: srcVal });
          targets.push({ id: tgtId, text: tgtDesc, correct_source_id: srcId });
          correctMap[tgtId] = srcId;
        });
      } else {
        sources.push({ id: 'src_1', text: 'Option 1' }, { id: 'src_2', text: 'Option 2' });
        targets.push({ id: 'tgt_1', text: 'Requirement 1', correct_source_id: 'src_1' });
        correctMap['tgt_1'] = 'src_1';
      }

      qData.answer_options = {
        source_title: 'Options',
        target_title: 'Requirements / Answer Area',
        sources,
        targets,
        pairs: sources.map((s, idx) => ({ source_id: s.id, target_id: targets[idx]?.id || 'tgt_1' }))
      };
      qData.correct_answer = correctMap;
      qData.partial_credit = true;

    } else if (optMatches.length > 0) {
      // Standard Multiple Choice or Multiple Response
      let promptText = preAns.substring(0, optMatches[0].index).trim();
      promptText = promptText.replace(/^QUESTION\s+\d+\s*/i, '');

      if (isCaseStudy) {
        const qLastMatch = promptText.match(/((?:Which|What|How|You need|Select|Where|Why)[\s\S]*?\?)\s*$/i);
        if (qLastMatch) {
          promptText = qLastMatch[1].trim();
        } else {
          const lines = promptText.split('\n').map(l => l.trim()).filter(Boolean);
          if (lines.length > 0) promptText = lines[lines.length - 1];
        }
      }

      qData.question_text = sanitizePrompt(promptText) || `Question ${qnum}`;

      const optionsList = optMatches.map(om => ({
        id: om[1].trim(),
        text: om[2].replace(/\s+/g, ' ').trim()
      }));
      qData.answer_options = optionsList;

      const letters = [...ansText.matchAll(/[A-F]/g)].map(m => m[0]);
      if (letters.length > 1) {
        qData.question_type = 'multiple_response';
        qData.correct_answer = letters;
        qData.required_selection_count = letters.length;
        qData.partial_credit = true;
      } else if (letters.length === 1) {
        qData.question_type = isCaseStudy ? 'case_study' : 'single_choice';
        qData.correct_answer = letters[0];
      } else {
        qData.question_type = 'single_choice';
        qData.correct_answer = optionsList[0]?.id || 'A';
      }
    } else {
      // Yes/No scenario
      let promptText = sanitizePrompt(preAns);
      qData.question_text = promptText || `Question ${qnum}`;
      if (ansText.toLowerCase().includes('yes')) {
        qData.question_type = 'yes_no';
        qData.correct_answer = 'Yes';
        qData.answer_options = ['Yes', 'No'];
      } else if (ansText.toLowerCase().includes('no')) {
        qData.question_type = 'yes_no';
        qData.correct_answer = 'No';
        qData.answer_options = ['Yes', 'No'];
      } else {
        qData.question_type = 'single_choice';
        qData.correct_answer = 'A';
        qData.answer_options = [{ id: 'A', text: 'Option A' }, { id: 'B', text: 'Option B' }];
      }
    }

    // Apply Authoritative Patch if present
    const patch = AB100_EXACT_PATCHES[qnum] || AB100_EXACT_PATCHES[String(qnum)];
    if (patch) {
      qData.question_type = patch.question_type;
      if (patch.question_text) qData.question_text = patch.question_text;
      if (patch.answer_options) qData.answer_options = patch.answer_options;
      if (patch.correct_answer !== undefined) qData.correct_answer = patch.correct_answer;
      if (patch.question_description) qData.question_description = patch.question_description;
      qData.partial_credit = true;
    }

    // Final clean on question_text
    qData.question_text = sanitizePrompt(qData.question_text);

    questions.push(qData);
  }

  // Summary counts
  const summary = {};
  for (const q of questions) {
    summary[q.question_type] = (summary[q.question_type] || 0) + 1;
  }

  onProgress(100, `Done! Parsed ${questions.length} questions.`);

  return {
    exam_info: examInfo,
    total_questions: questions.length,
    summary,
    questions
  };
}
