"""Umumiy importlar — barcha view modullar shu fayldan import qiladi."""
import csv, io, json, zipfile, os
from PIL import Image as PilImage
from rest_framework import generics, serializers as drf_serializers, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAuthenticatedOrReadOnly
from rest_framework.parsers import MultiPartParser
from django.db.models import Q
from django.utils import timezone
from django.http import HttpResponse
from django.conf import settings
from apps.persons.models import Person, Reminder, Family, AuditLog, Invite, PushSubscription, ShareLink
from apps.persons.serializers import (
    PersonSerializer, PersonShortSerializer, PersonTreeSerializer,
    ReminderSerializer, FamilySerializer, AuditLogSerializer,
    InviteSerializer, PublicPersonSerializer,
)
from apps.persons.audit import log_action, instance_to_dict, _diff
from apps.users.permissions import IsAdmin
