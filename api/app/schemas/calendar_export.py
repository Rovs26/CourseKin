"""Pydantic schemas for the calendar subscription endpoints."""

from pydantic import BaseModel


class CalendarSubscriptionResponse(BaseModel):
    token: str
    feed_url: str
    webcal_url: str
