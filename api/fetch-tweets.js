// gpt code api's are on environment variables on vercel



const { Rettiwt } = require('rettiwt-api');
const francModule = require('franc');
const franc = francModule.franc;
const express = require('express');
const app = express();

app.use(express.json());

// ✅ Fix #1: Read keys from environment variable (comma-separated)
const apiKeys = process.env.RETTIWT_KEYS
    ? process.env.RETTIWT_KEYS.split(',').map(k => k.trim()).filter(Boolean)
    : [];

if (apiKeys.length === 0) {
    console.error("❌ No API keys found in RETTIWT_KEYS environment variable.");
}

// ✅ Same delay logic as you wrote
function createRandomRettiwt() {
    const randomKey = apiKeys[Math.floor(Math.random() * apiKeys.length)];
    return new Rettiwt({
        apiKey: randomKey,
        logging: true,
        delay: () => 1000 + Math.random() * 1000
    });
}

// ✅ Tweet fetching logic – untouched
async function fetchTweets(topic, totalCount = 20) {
    try {
        console.log(`🚀 Starting fetch for '${topic}'...`);
        const allTweets = [];

        const filters = [
            { keywords: [topic] },
            { hashtags: [topic.replace('#', '')] }
        ];

        for (const filter of filters) {
            while (allTweets.length < totalCount) {
                const remaining = totalCount - allTweets.length;
                const batchSize = Math.min(50, remaining);

                const rettiwt = createRandomRettiwt();

                let tweets;
                try {
                    tweets = await rettiwt.tweet.search({
                        ...filter,
                        maxResults: batchSize
                    });
                } catch (err) {
                    console.error(`⚠️ API key error (will try another on next call): ${err.message}`);
                    continue;
                }

                if (!tweets || !tweets.list || tweets.list.length === 0) break;

                const englishTweets = tweets.list.filter(t =>
                    (t.fullText || '').length > 20 && franc(t.fullText || '') === 'eng'
                );

                allTweets.push(...englishTweets.map(t => ({ text: t.fullText })));

                console.log(`🔁 Fetched ${allTweets.length}/${totalCount} English tweets so far...`);

                await new Promise(resolve => setTimeout(resolve, 500));
            }

            if (allTweets.length >= totalCount) break;
        }

        return allTweets.slice(0, totalCount);

    } catch (error) {
        console.error('❌ Final Error:', error.message);
        throw error;
    }
}

// ✅ Express route – no change to core logic
app.post('/', async (req, res) => {
    try {
        const { topic } = req.body;
        if (!topic) {
            return res.status(400).json({ success: false, error: 'Topic is required.' });
        }

        console.log(`📩 Fetching 20 tweets for topic: "${topic}"`);
        const tweets = await fetchTweets(topic, 20);

        if (tweets.length > 0) {
            console.log(`✅ Successfully fetched ${tweets.length} English tweets`);
            return res.status(200).json({ success: true, tweets });
        } else {
            console.error('❌ No English tweets found');
            return res.status(404).json({ success: false, error: 'No suitable English tweets found.' });
        }
    } catch (error) {
        console.error('❌ API Internal Error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

// ✅ Export as Vercel handler
module.exports = app;
