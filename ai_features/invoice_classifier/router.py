from fastapi import APIRouter, UploadFile, File, HTTPException, Form, Depends
import logging
from .processor import InvoiceProcessor, get_settings
from .models import InvoiceClassificationResponse

router = APIRouter()
logger = logging.getLogger("InvoiceParserAPI")

processor: InvoiceProcessor | None = None

@router.on_event("startup")
async def startup_event():
    global processor
    if processor is None:
        try:
            processor = InvoiceProcessor()
            logger.info("InvoiceProcessor initialized successfully.")
        except ValueError as e:
            logger.error(f"Failed to initialize InvoiceProcessor on startup: {e}")
            pass

def get_processor():
    if processor is None:
        raise HTTPException(
            status_code=503, 
            detail="Service not configured. Please set the OPENAI_API_KEY environment variable."
        )
    return processor

@router.post(
    "/parse-and-classify-invoice", 
    response_model=InvoiceClassificationResponse,
    summary="Upload PDF/Image and classify the expense category."
)
async def parse_invoice_endpoint(
    file: UploadFile = File(..., description="The PDF or image file (max 10MB) containing the invoice."),
    model: str = Form(
        default=get_settings().MODEL_NAME, 
        description="The OpenAI model to use (e.g., gpt-4o, gpt-4o-mini)."
    ),
    proc: InvoiceProcessor = Depends(get_processor)
):
    """
    Receives an invoice file (PDF, JPG, PNG) and processes it using a hybrid 
    approach to extract structured data and classify the expense.
    
    You can specify the OpenAI model to use via the 'model' form field.
    """
    
    if file.filename is None or not any(file.filename.lower().endswith(ext) for ext in proc.settings.ALLOWED_EXTENSIONS):
        raise HTTPException(status_code=400, detail=f"Invalid file type. Allowed: {', '.join(proc.settings.ALLOWED_EXTENSIONS)}")

    file_content = await file.read()
    
    if len(file_content) == 0:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
        
    if len(file_content) > proc.settings.MAX_FILE_SIZE:
         raise HTTPException(status_code=413, detail=f"File size exceeds the maximum limit of {proc.settings.MAX_FILE_SIZE / 1024 / 1024:.0f}MB.")

    try:
        extracted_data = await proc.process_file_bytes(file_content, file.filename, model_name=model)
        
        final_class = extracted_data.get('expense_class') or proc.OTHER_CLASS
        
        inv_num = extracted_data.get('invoice_number')
        invoice_number_str = str(inv_num) if inv_num is not None else None

        return InvoiceClassificationResponse(
            expense_class=final_class,
            invoice_number=invoice_number_str,
            total_amount=extracted_data.get('total_amount'),
            currency=extracted_data.get('currency'),
            raw_response=extracted_data
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"An unexpected error occurred during endpoint execution for {file.filename}: {e}", exc_info=True)
        
        return InvoiceClassificationResponse(
            expense_class=proc.OTHER_CLASS,
            raw_response={"error": f"An unexpected server error occurred: {str(e)}"}
        )
