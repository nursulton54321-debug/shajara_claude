from django.contrib import admin
from .models import Person

@admin.register(Person)
class PersonAdmin(admin.ModelAdmin):
    list_display = ['full_name', 'gender', 'birth_date', 'death_date', 'age', 'child_number', 'created_by']
    search_fields = ['first_name', 'last_name', 'middle_name']
    list_filter = ['gender', 'created_by']
    raw_id_fields = ['father', 'mother']
