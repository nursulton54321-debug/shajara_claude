from ._base import *


class PersonExportCSVView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        persons = Person.objects.all().order_by('id')
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="shajara.csv"'
        response.write('﻿')  # UTF-8 BOM for Excel
        writer = csv.writer(response)
        writer.writerow([
            'id', 'familiya', 'ism', 'otasining_ismi',
            'jins', 'tugulgan_sana', 'vafot_sana',
            'telefon', 'nechanchi_farzand',
            'ota_id', 'ona_id', 'juft_id',
        ])
        for p in persons:
            writer.writerow([
                p.id, p.last_name or '', p.first_name or '', p.middle_name or '',
                p.gender or '', p.birth_date or '', p.death_date or '',
                p.phone or '', p.child_number or '',
                p.father_id or '', p.mother_id or '', p.spouse_id or '',
            ])
        log_action(request, 'export', model_name='CSV', changes={'rows': persons.count()})
        return response


class PersonImportCSVView(APIView):
    permission_classes = [IsAdmin]
    parser_classes = [MultiPartParser]

    def post(self, request):
        csv_file = request.FILES.get('file')
        if not csv_file:
            return Response({'error': 'CSV fayl yuklanmadi'}, status=400)
        try:
            content = csv_file.read().decode('utf-8-sig')
            reader = csv.DictReader(io.StringIO(content))
            created_count = updated_count = 0
            errors = []
            for row_num, row in enumerate(reader, start=2):
                try:
                    pk = row.get('id', '').strip()
                    data = {
                        'first_name':  row.get('ism', '').strip(),
                        'last_name':   row.get('familiya', '').strip(),
                        'middle_name': row.get('otasining_ismi', '').strip(),
                        'gender':      row.get('jins', 'male').strip() or 'male',
                        'phone':       row.get('telefon', '').strip() or None,
                    }
                    birth = row.get('tugulgan_sana', '').strip()
                    death = row.get('vafot_sana', '').strip()
                    cn    = row.get('nechanchi_farzand', '').strip()
                    if birth: data['birth_date'] = birth
                    if death: data['death_date'] = death
                    if cn:    data['child_number'] = int(cn)
                    if pk:
                        obj, created = Person.objects.update_or_create(
                            pk=int(pk), defaults={**data, 'created_by': request.user}
                        )
                        if created: created_count += 1
                        else:       updated_count += 1
                    else:
                        Person.objects.create(**data, created_by=request.user)
                        created_count += 1
                except Exception as e:
                    errors.append(f"Satr {row_num}: {str(e)}")
            log_action(request, 'import', model_name='CSV',
                       changes={'created': created_count, 'updated': updated_count, 'errors': len(errors)})
            return Response({
                'created': created_count, 'updated': updated_count,
                'errors': errors,
                'message': f"{created_count} ta qo'shildi, {updated_count} ta yangilandi",
            })
        except Exception as e:
            return Response({'error': str(e)}, status=400)


class BackupZipView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        buf = io.BytesIO()
        today = timezone.now().strftime('%Y-%m-%d')
        with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
            persons = Person.objects.all().order_by('id')
            persons_data = []
            for p in persons:
                photo_filename = None
                if p.photo:
                    try:
                        photo_filename = f"photos/{os.path.basename(p.photo.name)}"
                    except Exception:
                        pass
                persons_data.append({
                    'id': p.id, 'first_name': p.first_name or '', 'last_name': p.last_name or '',
                    'middle_name': p.middle_name or '', 'full_name': p.full_name,
                    'gender': p.gender or '',
                    'birth_date': str(p.birth_date) if p.birth_date else None,
                    'death_date': str(p.death_date) if p.death_date else None,
                    'birth_place': p.birth_place or '', 'phone': p.phone or '',
                    'child_number': p.child_number, 'father_id': p.father_id,
                    'mother_id': p.mother_id, 'photo_file': photo_filename,
                })
            zf.writestr('persons.json', json.dumps(persons_data, ensure_ascii=False, indent=2))

            families = Family.objects.select_related('husband', 'wife').all()
            families_data = [{
                'id': f.id, 'husband_id': f.husband_id,
                'husband_name': f.husband.full_name if f.husband else '',
                'wife_id': f.wife_id,
                'wife_name': f.wife.full_name if f.wife else '',
                'wedding_date': str(f.wedding_date) if f.wedding_date else None,
                'divorce_date': str(f.divorce_date) if f.divorce_date else None,
                'is_divorced': f.is_divorced, 'is_active': f.is_active,
                'note': f.note or '', 'order': f.order,
            } for f in families]
            zf.writestr('families.json', json.dumps(families_data, ensure_ascii=False, indent=2))

            readme = (
                f"Shajara Backup — {today}\n{'='*40}\n\n"
                f"Fayllar:\n"
                f"  persons.json  — {len(persons_data)} ta shaxs\n"
                f"  families.json — {len(families_data)} ta oila\n"
                f"  photos/       — rasmlar\n"
            )
            zf.writestr('README.txt', readme)

            for p in persons:
                if not p.photo:
                    continue
                try:
                    photo_path = p.photo.path
                    if os.path.exists(photo_path):
                        zf.write(photo_path, f"photos/{os.path.basename(photo_path)}")
                except Exception:
                    pass

        buf.seek(0)
        response = HttpResponse(buf.read(), content_type='application/zip')
        response['Content-Disposition'] = f'attachment; filename="shajara-backup-{today}.zip"'
        log_action(request, 'export', model_name='Backup',
                   changes={'persons': len(persons_data), 'families': len(families_data)})
        return response


class ImportZipView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'Fayl yuklanmadi'}, status=400)
        if not file.name.endswith('.zip'):
            return Response({'error': 'ZIP fayl yuklang'}, status=400)
        try:
            buf = io.BytesIO(file.read())
            with zipfile.ZipFile(buf, 'r') as zf:
                names = zf.namelist()
                if 'persons.json' not in names:
                    return Response({'error': 'persons.json topilmadi'}, status=400)
                persons_data = json.loads(zf.read('persons.json').decode('utf-8'))

                photo_map = {}
                for name in names:
                    if name.startswith('photos/') and name != 'photos/':
                        fname = os.path.basename(name)
                        if fname:
                            from django.core.files.base import ContentFile
                            photo_map[fname] = ContentFile(zf.read(name), name=fname)

                id_map = {}
                for pd in persons_data:
                    old_id = pd['id']
                    p, _ = Person.objects.get_or_create(
                        first_name=pd.get('first_name', ''),
                        last_name=pd.get('last_name', ''),
                        middle_name=pd.get('middle_name', '') or '',
                        gender=pd.get('gender', ''),
                        birth_date=pd.get('birth_date') or None,
                        defaults={
                            'death_date':   pd.get('death_date') or None,
                            'birth_place':  pd.get('birth_place', '') or '',
                            'phone':        pd.get('phone', '') or '',
                            'child_number': pd.get('child_number') or 0,
                        }
                    )
                    id_map[old_id] = p
                    photo_fname = os.path.basename(pd.get('photo_file') or '')
                    if photo_fname and photo_fname in photo_map and not p.photo:
                        p.photo.save(photo_fname, photo_map[photo_fname], save=True)

                for pd in persons_data:
                    p = id_map.get(pd['id'])
                    if not p:
                        continue
                    changed = False
                    if pd.get('father_id') and pd['father_id'] in id_map:
                        p.father = id_map[pd['father_id']]
                        changed = True
                    if pd.get('mother_id') and pd['mother_id'] in id_map:
                        p.mother = id_map[pd['mother_id']]
                        changed = True
                    if changed:
                        p.save(update_fields=['father', 'mother'])

                created_fam = 0
                if 'families.json' in names:
                    for fd in json.loads(zf.read('families.json').decode('utf-8')):
                        h = id_map.get(fd.get('husband_id'))
                        w = id_map.get(fd.get('wife_id'))
                        if h or w:
                            Family.objects.get_or_create(
                                husband=h, wife=w,
                                defaults={
                                    'wedding_date': fd.get('wedding_date') or None,
                                    'divorce_date': fd.get('divorce_date') or None,
                                    'is_divorced':  fd.get('is_divorced', False),
                                    'is_active':    fd.get('is_active', True),
                                    'note':         fd.get('note', '') or '',
                                    'order':        fd.get('order', 0) or 0,
                                }
                            )
                            created_fam += 1

            log_action(request, 'import', model_name='Backup',
                       changes={'persons': len(persons_data), 'families': created_fam})
            return Response({'persons': len(persons_data), 'families': created_fam})
        except zipfile.BadZipFile:
            return Response({'error': "Noto'g'ri ZIP fayl"}, status=400)
        except Exception as e:
            return Response({'error': str(e)}, status=500)
