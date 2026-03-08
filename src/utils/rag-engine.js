// Mock Vector Database / RAG Engine
// This simulates retrieving relevant context from a knowledge base before an LLM answers.

const KNOWLEDGE_BASE = {
  admin_compliance: [
    {
      id: "rbi_cir_109",
      tags: ["reversal", "unauthorized", "liability"],
      content: "As per RBI Circular on Customer Liability (DBR.No.Leg.BC.78/09.07.005/2017-18): Zero Liability of a Customer occurs if the unauthorized transaction occurs due to contributory fraud/negligence/deficiency on the part of the bank, or if a third-party breach is reported within 3 working days."
    },
    {
      id: "npc_sop_041",
      tags: ["dispute", "chargeback", "tat"],
      content: "NPCI standard operating procedure for UPI disputes requires the acquiring bank to provide transaction logs within T+2 days. In cases of confirmed AI high-confidence fraud blocks, the funds must be reversed to the remitter's account within T+1."
    },
    {
      id: "aml_act_2024",
      tags: ["aml", "money laundering", "kyc"],
      content: "Under the PMLA compliance framework, any account receiving rapid transactions across 5+ states within a 2-hour window triggers a mandatory KYC re-verification hold. The account must remain frozen until video-KYC is completed."
    }
  ],
  user_support: [
    {
      id: "faq_scam_01",
      tags: ["blocked", "scam", "safe"],
      content: "Your transaction was blocked because the recipient has been reported by multiple users for fraud today. Our AI system prevents these payments automatically to keep your money safe."
    },
    {
      id: "faq_device_02",
      tags: ["device", "location", "unusual", "suspicious"],
      content: "We noticed an attempt to make a payment from a device or location you haven't used before. To protect your account, we temporarily paused this request. Please review your activity log."
    },
    {
      id: "faq_velocity_03",
      tags: ["fast", "many", "limit"],
      content: "You've exceeded the normal rate of transactions for your account within a brief period. This velocity triggers our automated safeguards to prevent potential unauthorized mass transfers."
    }
  ]
};

// Simulate a latency-inducing RAG retrieval & generation process
export const queryRAG = async (query, persona = 'admin') => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const qTokens = query.toLowerCase().split(/\W+/);
      const corpus = KNOWLEDGE_BASE[persona === 'admin' ? 'admin_compliance' : 'user_support'];
      
      // 1. Retrieval Phase: Vector Search Simulation (Jaccard Similarity)
      let bestMatch = null;
      let highestScore = 0;

      for (const doc of corpus) {
        let score = 0;
        doc.tags.forEach(tag => {
          if (qTokens.includes(tag.toLowerCase())) score += 2;
        });
        
        // Bonus for literal string matches
        if (doc.content.toLowerCase().includes(query.toLowerCase())) score += 3;
        
        if (score > highestScore) {
          highestScore = score;
          bestMatch = doc;
        }
      }

      // 2. Generation Phase: Prompt Synthesis (Simulated LLM response)
      if (bestMatch && highestScore > 0) {
        const response = persona === 'admin' 
          ? `Based on internal compliance documents [Ref: ${bestMatch.id}]:\n\n${bestMatch.content}`
          : `I can help with that!\n\n${bestMatch.content}`;
        resolve(response);
      } else {
        const fallback = persona === 'admin'
          ? "No specific compliance directives found for this query in the vector database. Please refer to the master NPCI circular."
          : "I'm not exactly sure, but our support team is available 24/7 if you need further help with your transactions.";
        resolve(fallback);
      }

    }, 1500 + Math.random() * 1000); // Simulate network latency and generation time
  });
};
