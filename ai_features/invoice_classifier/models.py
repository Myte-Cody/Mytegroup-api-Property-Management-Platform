from pydantic import BaseModel, Field
from typing import Optional, Dict, Any

class InvoiceClassificationResponse(BaseModel):
    """The final response model returned by the API."""
    expense_class: str = Field(..., description="The classified expense category or 'Other' if not an invoice.")
    invoice_number: Optional[str] = None
    total_amount: Optional[float] = None
    currency: Optional[str] = None
    raw_response: Dict[str, Any] = Field(..., description="The full structured data extracted from the invoice.")
