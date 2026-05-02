@echo off
echo Starting FIT Platform...

REM Resolve pnpm location for cmd shells
set "PNPM=pnpm"
where pnpm > nul 2>&1
if errorlevel 1 (
    if exist "%USERPROFILE%\AppData\Roaming\npm\pnpm.cmd" set "PNPM=%USERPROFILE%\AppData\Roaming\npm\pnpm.cmd"
    if "%PNPM%"=="pnpm" (
        where npx > nul 2>&1
        if errorlevel 1 (
            echo pnpm and npx not found. Install pnpm or add it to PATH.
            pause
            exit /b 1
        )
        set "PNPM=npx pnpm"
    )
)

REM Start PostgreSQL if not already running
echo Checking PostgreSQL...
sc query postgresql-x64-17 | find "RUNNING" > nul
if errorlevel 1 (
    echo Starting PostgreSQL...
    net start postgresql-x64-17
    timeout /t 3 /nobreak > nul
)

REM Ensure database exists
echo Ensuring database exists...
set PGPASSWORD=postgres
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='fit'" | find "1" > nul
if errorlevel 1 (
    echo Creating database "fit"...
    "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -c "CREATE DATABASE fit;"
)

REM Apply schema updates
echo Applying schema...
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d fit -f "C:\Users\mahaj\Downloads\FIT\apps\api\db\schema.sql"
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d fit -c "UPDATE tenants SET gstin='27AABCU9603R1ZX', legal_name='Demo Gym Pvt Ltd', address='123 Demo Street, Mumbai, MH', state_code='27' WHERE id='11111111-1111-1111-1111-111111111111';"

REM Export shared env vars for child cmd windows
set "DATABASE_URL=postgresql://fit:fit@localhost:5432/fit"
set "JWT_SECRET=dev_secret_min_32_chars_long_here"
set "JWT_EXPIRY=15m"
set "REFRESH_TOKEN_EXPIRY=30d"
set "NODE_ENV=development"
set "PORT=4000"
set "RAZORPAY_KEY_ID=rzp_test_placeholder"
set "RAZORPAY_KEY_SECRET=placeholder"
set "RAZORPAY_WEBHOOK_SECRET=fit_dev_webhook_secret"

REM Start API
echo Starting API...
start "FIT API" cmd /k "cd /d C:\Users\mahaj\Downloads\FIT && %PNPM% --filter @fit/api dev"

REM Wait for API to be ready
echo Waiting for API...
timeout /t 8 /nobreak > nul

REM Start Worker
echo Starting Worker...
start "FIT Worker" cmd /k "cd /d C:\Users\mahaj\Downloads\FIT && %PNPM% --filter @fit/worker dev"

REM Start Frontend
echo Starting Frontend...
start "FIT Frontend" cmd /k "cd /d C:\Users\mahaj\Downloads\FIT\Frontend && npm run dev"

REM Wait then open browser
timeout /t 6 /nobreak > nul
echo Opening browser...
start http://localhost:5173

echo.
echo FIT Platform is starting...
echo API:      http://localhost:4000
echo Frontend: http://localhost:5173
echo Worker:   health on http://localhost:3001/health
echo.
echo Check each terminal window for errors.
pause
