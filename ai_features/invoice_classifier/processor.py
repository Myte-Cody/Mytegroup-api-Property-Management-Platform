import os
import base64
import fitz
from openai import OpenAI
import asyncio
import time
import json
import io
from datetime import datetime
from PIL import Image
from typing import Optional, List, Dict, Any

from fastapi import HTTPException
from dotenv import load_dotenv

from .constants import EXPENSE_CLASSES, OTHER_CLASS

load_dotenv()

if not os.environ.get("OPENAI_API_KEY"):
    print("FATAL ERROR: OPENAI_API_KEY is not set in environment or .env file.")

def get_settings():
    """Fetches environment settings."""
    class Settings:
        OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
        MODEL_NAME = "gpt-4o-mini"
        ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg']
        MAX_FILE_SIZE = 10 * 1024 * 1024
    return Settings()


import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("InvoiceParserAPI")

def setup_logging():
    return logger, logger

def calculate_token_usage(response):
    usage = response.usage
    return {
        'prompt_tokens': usage.prompt_tokens,
        'completion_tokens': usage.completion_tokens,
        'total_tokens': usage.total_tokens
    }

def log_api_call(*args, **kwargs):
    pass

def validate_invoice_content(data):
    """Checks if core fields are present to confirm it's a valid invoice."""
    return (data.get('expense_class') is not None) and (data.get('total_amount') is not None)


class InvoiceProcessor:
    """
    A hybrid invoice parser using raw text extraction and image recognition
    via the OpenAI API with a function call tool.
    """

    def __init__(self):
        self.settings = get_settings()

        if not self.settings.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY environment variable is not set. Cannot initialize InvoiceProcessor.")

        self.logger, self.api_logger = setup_logging()
        self.client = OpenAI(api_key=self.settings.OPENAI_API_KEY)
        self.tools = self._define_tools()

    def _define_tools(self):
        """Defines the JSON schema for the invoice parsing function call."""

        classification_descriptions = (
            "The most appropriate classification. CHOOSE WISELY based on these detailed descriptions:\n"
            "1. Maintenance & Repairs: Routine, preventative, or reactive *physical fixes* involving *hands-on work* or *replacing parts* of a system.\n"
            "2. Utilities & Energy: Recurring bills for essential services like energy, water, or waste management.\n"
            "3. Property Management & Admin Fees: Recurring fees for management, administrative services, or financial operations.\n"
            "4. Supplies & Consumables: Small, recurring purchases for day-to-day operations.\n"
            "5. Landscaping & Outdoor Maintenance: Maintenance and upkeep of outdoor areas.\n"
            "6. Contractor Services (External Work Orders): *Large-scale, project-based physical work* performed by external contractors, often tied to specific agreements or work orders.\n"
            "7. Insurance & Compliance: Costs related to risk management, safety, and regulatory adherence.\n"
            "8. Staff & Labor: Salaries or wages for recurring on-site personnel.\n"
            "9. Taxes & Permits: Government-imposed fees, taxes, or licenses.\n"
            "10. Capital Expenditures (CapEx): *Large, one-time upgrades or installations* that enhance or replace major systems or structures.\n"
            "11. Professional Services: Third-party *consulting* and *advisory* services involving *intangible expertise* or specialized knowledge."
        )

        return [{
            "type": "function",
            "function": {
                "name": "parse_invoice",
                "description": "Analyze this document. If it is not a valid invoice, return null for ALL fields. Only extract information explicitly present in the document. The 'expense_class' must be one of the provided enumerated values.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "vendor_name": {"type": ["string", "null"]},
                        "vendor_address": {"type": ["string", "null"]},
                        "invoice_number": {"type": ["string", "null"]},
                        "invoice_date": {"type": ["string", "null"], "description": "Format: YYYY-MM-DD or MM-YYYY if day is unknown. Use null if not found."},
                        "due_date": {"type": ["string", "null"], "description": "Format: YYYY-MM-DD or MM-YYYY if day is unknown. Use null if not found."},
                        "total_amount": {"type": ["number", "null"], "description": "The total amount of the invoice, including taxes."},
                        "currency": {"type": ["string", "null"], "description": "The currency of the total amount (e.g., DZD, EUR, USD)."},
                        "tax_amount": {"type": ["number", "null"]},
                        "description_summary": {"type": ["string", "null"], "description": "A brief, one-sentence summary of the goods or services provided.",},
                        "expense_class": {
                            "type": ["string", "null"],
                            "enum": EXPENSE_CLASSES,
                            "description": classification_descriptions
                        }
                    },
                    "required": ["total_amount", "expense_class"]
                }
            }
        }]

    def _extract_text_content(self, file_content: bytes, extension: str) -> str:
        text = ""
        try:
            if extension == 'pdf':
                with fitz.open(stream=file_content, filetype="pdf") as doc:
                    for page in doc:
                        text += page.get_text() + "\n\n"
        except Exception:
            self.logger.warning(f"Could not extract text from {extension}")
            return ""
        return text

    @staticmethod
    def pdf_to_images(pdf_bytes):
        images = []
        try:
            with fitz.open(stream=pdf_bytes, filetype="pdf") as pdf:
                for page_num, page in enumerate(pdf):
                    if page_num >= 3: break
                    pix = page.get_pixmap(dpi=150)
                    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                    images.append(img)
        except Exception as e:
            raise ValueError(f"Failed to convert PDF to image: {e}")
        return images

    @staticmethod
    def concat_images(images):
        if not images: return Image.new("RGB", (1, 1), 'white')
        widths, heights = zip(*(img.size for img in images))
        total_width = max(widths)
        total_height = sum(heights)
        concatenated_image = Image.new('RGB', (total_width, total_height), 'white')
        y_offset = 0
        for img in images:
            concatenated_image.paste(img, (0, y_offset))
            y_offset += img.size[1]
        return concatenated_image

    def convert_to_image(self, file_content: bytes, filename: str) -> Image.Image:
        extension = filename.lower().split('.')[-1]
        try:
            if extension in ['jpg', 'jpeg', 'png', 'gif']:
                return Image.open(io.BytesIO(file_content))
            elif extension == 'pdf':
                images = self.pdf_to_images(file_content)
                return self.concat_images(images)
            else:
                return Image.new("RGB", (100, 100), "white")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to process file: {e}")

    @staticmethod
    async def encode_image(image: Image.Image) -> str:
        try:
            buffer = io.BytesIO()
            image.save(buffer, format='PNG')
            return base64.b64encode(buffer.getvalue()).decode('utf-8')
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Image encoding error: {e}")

    def _validate_and_clean_data(self, data):
        if isinstance(data, dict):
            return {k: self._validate_and_clean_data(v) for k, v in data.items()}
        if isinstance(data, list):
            if not data: return None
            return [self._validate_and_clean_data(item) for item in data]
        if isinstance(data, str) and not data.strip():
            return None
        return data

    def _generate_null_response(self, filename, process_start_time, contents_size, token_usage):
        return {
            "vendor_name": None, "vendor_address": None, "invoice_number": None,
            "invoice_date": None, "due_date": None, "total_amount": None,
            "currency": None, "tax_amount": None, "description_summary": None,
            "expense_class": OTHER_CLASS,
            "metadata": {
                "filename": filename, "processing_time": f"{time.time() - process_start_time:.2f}s",
                "timestamp": datetime.now().isoformat(), "file_size": f"{contents_size/1024:.1f}KB",
                "token_usage": token_usage, "error": "Document does not appear to be a valid invoice or is empty."
            }
        }

    async def process_file_bytes(self, file_content: bytes, filename: str, model_name: str) -> Dict[str, Any]:
        """Main function to process the file content bytes."""
        started_at = datetime.now()
        process_start_time = time.time()
        extension = filename.lower().split('.')[-1]

        image = self.convert_to_image(file_content, filename)
        encoded_image = await self.encode_image(image)
        raw_text = self._extract_text_content(file_content, extension)

        messages = [
            {
                "role": "system",
                "content": (
                    "You are a world-class invoice parsing and expense classification expert. "
                    "Your sole job is to accurately extract data into the requested JSON format. "
                    "**You MUST strictly follow the detailed descriptions provided in the `expense_class` parameter definition.** "
                    "**Pay close attention to the difference between *physical work* (like repairs) and *non-physical services* (like audits or assessments).** "
                    "If the document is NOT an invoice, return null for ALL fields."
                )
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "Please analyze this document. Use the image for layout and the raw text for accuracy. "
                            "Adhere strictly to the `parse_invoice` function's requirements. "
                            "**Pay close attention to the detailed descriptions for `expense_class` to distinguish between '1. Maintenance' (physical repairs), '10. CapEx' (new installations), and '11. Professional Services' (non-physical consulting, like a structural assessment).** "
                            "If it is NOT an invoice, return null for all fields."
                            f"\n\n--- Raw Text from Document ---\n{raw_text}" if raw_text else ""
                        )
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{encoded_image}",
                            "detail": "low"
                        }
                    }
                ]
            }
        ]

        input_data = {'filename': filename}

        try:
            api_start_time = time.time()
            response = await asyncio.to_thread(
                self.client.chat.completions.create,
                model=model_name,
                messages=messages,
                tools=self.tools,
                tool_choice="required"
            )
            api_duration = time.time() - api_start_time
            token_usage = calculate_token_usage(response)

            response_message = response.choices[0].message

            if not response_message.tool_calls:
                 logger.error(f"AI failed to call tool for {filename}")
                 return self._generate_null_response(filename, process_start_time, len(file_content), token_usage)

            tool_call = response_message.tool_calls[0]
            invoice_data = json.loads(tool_call.function.arguments)

            invoice_data = self._validate_and_clean_data(invoice_data)

            if not validate_invoice_content(invoice_data):
                logger.warning(f"Validation failed for {filename}, classifying as 'Other'. Data: {invoice_data}")
                null_resp = self._generate_null_response(filename, process_start_time, len(file_content), token_usage)
                null_resp['metadata']['raw_ai_output'] = invoice_data
                return null_resp

            total_processing_time = time.time() - process_start_time
            invoice_data["metadata"] = {
                "processing_time": f"{total_processing_time:.2f}s",
                "token_usage": token_usage,
                "api_processing_time": f"{api_duration:.2f}s",
                "filename": filename,
                "timestamp": started_at.isoformat(),
                "file_size": f"{len(file_content)/1024:.1f}KB",
                "model_used": model_name
            }

            log_api_call(self.api_logger, function="invoice_parsing", input_data=input_data, output_data=invoice_data,
                         input_tokens=token_usage['prompt_tokens'], output_tokens=token_usage['completion_tokens'],
                         started_at=started_at, finished_at=datetime.now(), status="success")

            return invoice_data

        except Exception as e:
            logger.error(f"Processing error for {filename}: {e}", exc_info=True)
            token_usage = {'prompt_tokens': 0, 'completion_tokens': 0, 'total_tokens': 0}
            null_resp = self._generate_null_response(filename, process_start_time, len(file_content), token_usage)
            null_resp['metadata']['error'] = f"Unexpected processing error: {str(e)}"
            return null_resp
