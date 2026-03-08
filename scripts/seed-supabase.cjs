const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Supabase Client
const supabaseUrl = 'https://boxsnuwicriuxxsyciak.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJveHNudXdpY3JpdXh4c3ljaWFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5Njc2NTAsImV4cCI6MjA4ODU0MzY1MH0.U4zhls8kiWyrVG6vunVe7goTXquIMTmoJu1XVMGgJqY';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const DATA_FILE = path.join(__dirname, '../datasets/UPI_Synthetic_Transaction_Dataset_660.csv');

async function seedDatabase() {
    console.log('🌱 Starting Supabase Seeding Process...');
    
    if (!fs.existsSync(DATA_FILE)) {
        console.error('❌ Error: Dataset CSV not found. Run generate-datasets.cjs first.');
        process.exit(1);
    }

    const csvData = fs.readFileSync(DATA_FILE, 'utf-8');
    const lines = csvData.trim().split('\n');
    
    // Remove the header row
    lines.shift();

    const transactions = [];

    // Parse CSV safely handling quotes
    for(let i = 0; i < lines.length; i++) {
        // Simple regex to split by comma but ignore commas inside quotes
        const rawMatches = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
        const parts = rawMatches.map(p => p.replace(/^"|"$/g, ''));

        if(parts.length >= 10) {
            transactions.push({
                // Ignoring ID purely to let Supabase auto-increment if configured, or passing raw
                amount: parseFloat(parts[1]),
                merchant: parts[2],
                device: parts[3],
                hour: parseInt(parts[6]),
                fraud_score: parseFloat(parts[8]),
                is_fraud: parts[9] === "1",
                status: parts[10],
                indicators: parts[11] ? parts[11].split(';') : [],
                explanation: parts[9] === "1" ? "Detected historical risk patterns." : "No significant risk factors detected.",
                created_at: new Date(Date.now() - Math.floor(Math.random() * 86400000 * 7)).toISOString() // Randomize over last 7 days
            });
        }
    }

    console.log(`Parsed ${transactions.length} transactions. Pushing to Supabase in batches...`);

    // Supabase limits bulk inserts, so we do it in batches of 100
    const BATCH_SIZE = 100;
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
        const batch = transactions.slice(i, i + BATCH_SIZE);
        
        const { error } = await supabase
            .from('transactions')
            .insert(batch);
            
        if (error) {
            console.error(`❌ Error inserting batch ${i/BATCH_SIZE + 1}:`, error.message);
            failCount += batch.length;
        } else {
            successCount += batch.length;
            console.log(`✓ Batch ${i/BATCH_SIZE + 1} successful. (${successCount} total)`);
        }
    }

    console.log('\n=======================================');
    console.log('✅ Seeding Complete!');
    console.log(`Successfully uploaded: ${successCount}`);
    console.log(`Failed to upload: ${failCount}`);
    console.log('=======================================');
}

seedDatabase();
