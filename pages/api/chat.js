// Import the Anthropic SDK
import Anthropic from '@anthropic-ai/sdk';

// Create an Anthropic client using our API key
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// This function handles requests to /api/chat
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Extract data from the request
    const { messages, systemPrompt } = req.body;
    
    // Call Anthropic's API
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      system: systemPrompt,
      messages: messages
    });

    // Send the response back to the frontend
    res.status(200).json({ content: response.content[0].text });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Failed to get AI response' });
  }
}