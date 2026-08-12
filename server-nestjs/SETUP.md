# Setup Instructions - Ayuda por Colombia NestJS Backend

## Prerequisites

Make sure you have Node.js 20+ and PostgreSQL installed.

## Installation Steps

### 1. Install Dependencies
```bash
cd server-nestjs
npm install
```

### 2. Environment Setup
Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` with your database configuration:
```env
DATABASE_URL="postgresql://your_user:your_password@localhost:5434/ayudaporcolombia?schema=public"
PORT=4000
NODE_ENV=development
CLIENT_ORIGIN="http://localhost:5173"
JWT_SECRET="change-this-in-production"
```

### 3. Database Setup
```bash
# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Seed database with sample data
npm run seed
```

### 4. Start Development Server
```bash
npm run start:dev
```

The server will start at `http://localhost:4000`

## Default Credentials

After seeding, you can login with:
- **Moderator**: `moderator@ayudaporcolombia.co` / `Admin123!`
- **User**: `juan@example.com` / `User123!`

## API Testing

You can test the API with tools like Postman or curl:

### Register User
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "Password123!"
  }'
```

### Login
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Password123!"
  }'
```

### Get Public Points
```bash
curl http://localhost:4000/api/points
```

## Troubleshooting

### PowerShell Script Execution Issues
If you get "script execution is disabled" errors:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Database Connection Issues
- Ensure PostgreSQL is running
- Check DATABASE_URL in .env file
- Verify database exists and has correct permissions

### Build Errors
- Clear node_modules: `rm -rf node_modules && npm install`
- Clear dist folder: `rm -rf dist && npm run build`

## Development

### Running Tests
```bash
npm test
```

### Generate Prisma Client
```bash
npm run prisma:generate
```

### Open Prisma Studio
```bash
npm run prisma:studio
```

### Build for Production
```bash
npm run build
npm run start:prod
```