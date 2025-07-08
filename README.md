# Idea Auction Platform

A decentralized marketplace for trading ideas and opinions using Next.js 14 and Firebase.

## Features

- **Real Authentication**: Email link authentication powered by Firebase
- **Opinion Trading**: Buy and sell ideas in a dynamic marketplace
- **User Profiles**: Personalized profiles with trading history and stats
- **Real-time Updates**: Live price feeds and market activity
- **Responsive Design**: Works seamlessly on desktop and mobile
- **Modern Stack**: Built with Next.js 14, TypeScript, and Firebase

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Firebase project with email link authentication enabled
- Email/password authentication enabled in Firebase Console

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd idea-auction
```

2. Install dependencies:
```bash
npm install
```

3. Set up Firebase:
   - Create a new Firebase project at [Firebase Console](https://console.firebase.google.com/)
   - Enable Authentication > Sign-in method > Email link (passwordless sign-in)
   - Enable Firestore Database
   - Update `app/lib/firebase.ts` with your Firebase configuration

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Authentication Flow

1. User enters email on sign-in page
2. Firebase sends secure login link to email
3. User clicks link to complete authentication
4. New users automatically get a profile created
5. Returning users are logged in with their existing profile

## Project Structure

```
app/
├── api/              # API routes
├── auth/             # Authentication pages
├── auth-complete/    # Login link completion
├── components/       # Reusable components
├── feed/             # Opinion feed
├── generate/         # Idea generation
├── lib/              # Utilities and configuration
├── opinion/          # Opinion details
├── profile/          # User profiles
└── users/            # User directory
```

## Configuration

### Firebase Setup

1. Go to Firebase Console > Authentication > Sign-in method
2. Enable "Email link (passwordless sign-in)"
3. Add your domain to authorized domains
4. Update Firebase config in `app/lib/firebase.ts`

### Environment Variables

No environment variables are required for basic functionality as Firebase config is in the client-side code.

## Deployment

This is a Next.js application that can be deployed to:

- Vercel (recommended)
- Netlify
- Firebase Hosting
- Any hosting platform that supports Next.js

### Deploy to Vercel

1. Push code to GitHub
2. Connect repository to Vercel
3. Deploy automatically

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License.
