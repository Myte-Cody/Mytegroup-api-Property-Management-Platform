from fastapi import FastAPI


from invoice_classifier.router import router as invoice_router
from voice_assistant.router import router as voice_assistant_router

app = FastAPI(title="Myte AI API")


app.include_router(invoice_router, prefix="/invoice-classifier", tags=["Invoice Classification"])
app.include_router(voice_assistant_router, prefix="/voice-assistant", tags=["Voice Assistant"])

if __name__ == "__main__":
    import uvicorn
    print("Starting Myte AI server on http://127.0.0.1:8000")
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
