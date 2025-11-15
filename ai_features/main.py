from fastapi import FastAPI
from invoice_classifier.router import router as invoice_router

app = FastAPI(title="AI Features API")

app.include_router(invoice_router, prefix="/invoice-classifier", tags=["Invoice Classification"])

if __name__ == "__main__":
    import uvicorn
    print("Starting FastAPI server on http://127.0.0.1:8000")
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
