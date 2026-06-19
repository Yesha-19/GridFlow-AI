# Gridflow

Gridflow is an event-driven congestion prediction system built for the Bengaluru Traffic Police. It uses historical traffic data and machine learning to forecast the impact of planned events (rallies, sports) and unplanned incidents (accidents) to recommend optimal manpower, barricading, and diversion plans.

## Prerequisites

Before running the application, make sure you have the following installed on your system:
- **Python 3.11+**
- **Node.js (v18+) and npm**

---

## How to Run the Application

The application consists of a FastAPI backend and a React/Vite frontend. You will need to open **two separate terminal windows** to run both servers simultaneously.

### 1. Start the Backend API (Terminal 1)

The backend handles the ML model inference, database interactions, and business logic (resource allocation, routing).

1. Open a terminal and navigate to the project root directory.

2. **Crucial Step — Database Setup:** Create a `.env` file inside the `backend/` directory with your Supabase PostgreSQL connection string:
   ```bash
   DATABASE_URL="postgresql+asyncpg://postgres:[YOUR-PASSWORD]@[YOUR-SUPABASE-REF].supabase.co:5432/postgres"
   ```
   *(Note: You do NOT need to run any SQL scripts in Supabase. Just provide a completely empty database. When the FastAPI server starts, it will automatically build all the tables and seed them with the historical dataset!)*

3. Activate the Python virtual environment:
   ```bash
   venv\Scripts\activate
   ```
   
   *run `pip install -r backend\requirements.txt` to install the backend dependencies.*

4. Set the encoding (required for the terminal UI):
   ```bash
   set PYTHONIOENCODING=utf-8
   ```

5. Navigate to the backend directory and start the FastAPI server:
   ```bash
   cd backend
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```
   *The backend is now running at `http://localhost:8000`*

### 2. Start the Frontend Application (Terminal 2)

The frontend is a Vite + React application that provides the tactical dashboard for the traffic police.

1. Open a **new** terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. **Crucial Step — Auth Setup:** Create a `.env.local` file inside the `frontend/` directory with your Supabase API keys (found in your Supabase Dashboard under Project Settings > API):
   ```bash
   VITE_SUPABASE_URL="https://[YOUR-SUPABASE-REF].supabase.co"
   VITE_SUPABASE_ANON_KEY="[YOUR-ANON-KEY]"
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```

4. Open your web browser and go to the link provided by Vite (usually `http://localhost:5173`).

---

## (Optional) Retraining the ML Model

The ML model (`xgboost`) is already trained and saved in `ml/models/`. However, if you ever update the dataset and want to retrain it:

1. Open a terminal in the project root and activate the virtual environment:
   ```bash
   venv\Scripts\activate
   ```
2. Run the training pipeline:
   ```bash
   set PYTHONIOENCODING=utf-8
   python ml/train_model.py
   ```
3. Run the evaluation script to see the performance report:
   ```bash
   set PYTHONIOENCODING=utf-8
   python ml/evaluate.py
   ```

---

## Project Structure

* **`ml/`**: Machine learning pipelines, feature engineering, and trained model files.
* **`backend/`**: FastAPI server, Supabase PostgreSQL database logic, and routing/resource microservices.
* **`frontend/`**: React application featuring the tactical map, event timeline, severity badge, and analytics dashboard.
* **`datasets/`**: Anonymized raw historical event data used for training.
