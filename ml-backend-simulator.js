const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Mock ML Pipeline Microservice
// In production, this would be a Python/Flask service running the actual XGBoost/Ensemble models
app.post('/api/v1/predict', (req, res) => {
    const { amount, merchant, device, hour, ...features } = req.body;
    
    console.log(`[ML-ENGINE] Analyzing transaction: ₹${amount} to ${merchant}`);
    
    // Simulate inference latency
    setTimeout(() => {
        // Simple mock logic for demonstration purposes
        const merchantLower = (merchant || '').toLowerCase();
        let isFraud = false;
        let score = Math.random() * 0.2; // Base safe score
        
        if (merchantLower.includes('scam') || merchantLower.includes('fraud') || merchantLower.includes('fake')) {
            isFraud = true;
            score = 0.95 + (Math.random() * 0.04);
        } else if (amount > 100000 && hour > 22) {
            isFraud = true;
            score = 0.85 + (Math.random() * 0.1);
        }

        const response = {
            transaction_id: `TXN${Date.now()}`,
            timestamp: new Date().toISOString(),
            risk_score: parseFloat(score.toFixed(3)),
            status: score > 0.8 ? 'BLOCKED' : score > 0.6 ? 'FLAGGED' : 'CLEARED',
            models_consensus: {
                random_forest: Math.min(0.99, score + (Math.random() * 0.1 - 0.05)),
                xgboost: Math.min(0.99, score + (Math.random() * 0.1 - 0.05)),
                isolation_forest: Math.min(0.99, score + (Math.random() * 0.15 - 0.07)),
            },
            latency_ms: Math.floor(Math.random() * 45) + 12 // Sub-50ms latency is crucial for UPI
        };
        
        console.log(`[ML-ENGINE] Result: ${response.status} (Score: ${response.risk_score})`);
        res.json(response);
    }, Math.random() * 100 + 50);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`🚀 Fraud Detection ML Microservice listening on port ${PORT}`);
    console.log(`Ready to process high-throughput UPI transactions.`);
});
