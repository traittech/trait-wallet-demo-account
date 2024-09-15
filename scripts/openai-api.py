import requests
import json

# URL of the API endpoint
endpoint = 'https://api.openai.com/v1/chat/completions'
imageUrl = 'https://trait-wallet-demo-account.trait.tech/game-c/nft-collection-c-a/nft-token-c-a-a/icon_150x150.png'
prompt = 'act as a game narrator and describe in 100 words'
apiKey = 'Bearer api-key'

data = {
    "model": "gpt-4o-mini",
    "max_tokens": 300,
    "messages": [
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": prompt
                },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": imageUrl,
                        "detail": "high"
                    }
                }
            ]
        }
    ]
}


# Headers (optional, depending on the API)
headers = {
    'Content-Type': 'application/json',
    'Authorization': apiKey  # if authentication is needed
}

# Make the POST request with JSON input
response = requests.post(endpoint, data=json.dumps(data), headers=headers)

# Check if the request was successful
if response.status_code == 200:
    # Parse the JSON response
    response_data = response.json()
    print("Response:", response_data)
else:
    print(f"Request failed with status code {response.status_code}")
    print(response.text)


