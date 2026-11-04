import { describe, expect, it } from 'vitest';
import { buildCsv, csvCell } from '../src/core/csv';
import { demoPlan } from '../src/core/demo';
import { TODAY, distribute } from './helpers';

describe('csvCell', () => {
  it.each([
    ['=1+1', "'=1+1"],
    ['+7999', "'+7999"],
    ['-2', "'-2"],
    ['@SUM(A1)', "'@SUM(A1)"],
    ['  =cmd', "'  =cmd"],
    ['\t=x', "'\t=x"],
  ])('нейтрализует формулу %j', (input, expected) => {
    expect(csvCell(input)).toBe(expected);
  });
  it('экранирует разделитель, кавычки и переводы строк', () => {
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
  });
  it('обычный текст и числа не меняет', () => {
    expect(csvCell('Привет')).toBe('Привет');
    expect(csvCell(3)).toBe('3');
  });
});

describe('buildCsv', () => {
  it('начинается с BOM, разделитель «;», одна строка на назначение', () => {
    const csv = buildCsv(distribute(demoPlan()), TODAY);
    expect(csv.startsWith('﻿')).toBe(true);
    const rows = csv.trim().split('\r\n');
    expect(rows[0]).toContain('Линия;Приоритет');
    expect(rows).toHaveLength(1 + 14);
    expect(csv).not.toContain('НЕ ХВАТАЕТ');
  });
  it('нехватка попадает в файл отдельными строками', () => {
    const plan = demoPlan();
    plan.authors.forEach((a) => (a.active = false));
    const csv = buildCsv(distribute(plan), TODAY);
    expect(csv).toContain('НЕ ХВАТАЕТ');
    expect(csv).toContain('— НЕ НАЗНАЧЕНО —');
  });
  it('вредоносное имя автора не превращается в формулу', () => {
    const plan = distribute(demoPlan());
    plan.authors[0]!.name = '=HYPERLINK("http://evil")';
    expect(buildCsv(plan, TODAY)).not.toMatch(/;=HYPERLINK/);
  });
});
