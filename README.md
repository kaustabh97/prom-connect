# Hello

## To run frontend and setup code

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev

```

## To run backend and setup AWS amplify Sandbox

https://aws.amazon.com/amplify/

npm install -g @aws-amplify/cli
npx amplify@latest init

npx amplifty 

npx amplify sandbox set GOOGLE_CLIENT_ID <Google_Client_ID>
npx amplify sandbox set GOOGLE_CLIENT_SECRET <Google_Client_Secret>

npx amplify sandbox (inside frontend package, amplify code is prom-connect/amplify/)

(Sets up backend sandbox etc)