# -*- coding: utf-8 -*-
# Generated by Django 1.9.7 on 2016-07-29 21:57
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('contentcuration', '0004_auto_20160720_1220'),
    ]

    operations = [
        migrations.AddField(
            model_name='formatpreset',
            name='thumbnail',
            field=models.BooleanField(default=False),
        ),
    ]