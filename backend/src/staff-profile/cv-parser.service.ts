import { Injectable } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import * as mammoth from 'mammoth';

export interface ParsedCvResult {
  name?: string;
  email?: string;
  phone?: string;
  skills: string[];
  education: Array<{ institution?: string; qualification?: string; year?: string }>;
  pastExperience: Array<{ employer?: string; title?: string; startDate?: string; endDate?: string; description?: string }>;
  rawText: string;
}

const SECTION_HEADERS = {
  experience: /^(work experience|professional experience|experience|employment history)\s*$/i,
  education: /^(education|academic background|qualifications)\s*$/i,
  skills: /^(skills|technical skills|core competencies)\s*$/i,
};

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_REGEX = /(\+?\d[\d\s().-]{7,}\d)/;
const DATE_RANGE_REGEX = /((?:[A-Za-z]{3,9}\s)?\d{4})\s*[-–—to]+\s*((?:[A-Za-z]{3,9}\s)?\d{4}|present|current)/i;

@Injectable()
export class CvParserService {
  async extractText(fileBuffer: Buffer, mimeType: string): Promise<string> {
    if (mimeType === 'application/pdf') {
      const parser = new PDFParse({ data: fileBuffer });
      try {
        const result = await parser.getText();
        return result.text;
      } finally {
        if (typeof (parser as any).destroy === 'function') {
          await (parser as any).destroy();
        }
      }
    }
    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword'
    ) {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      return result.value;
    }
    throw new Error(`Unsupported CV file type: ${mimeType}. Use PDF or DOCX.`);
  }

  parse(rawText: string): ParsedCvResult {
    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const fullText = rawText;
    const email = fullText.match(EMAIL_REGEX)?.[0];
    const phone = fullText.match(PHONE_REGEX)?.[0]?.trim();
    const name = lines.find(l => !EMAIL_REGEX.test(l) && !PHONE_REGEX.test(l) && l.length < 60 && l.length > 2);
    const sections = this.splitIntoSections(lines);
    const pastExperience = this.parseExperienceSection(sections.experience ?? []);
    const education = this.parseEducationSection(sections.education ?? []);
    const skills = this.parseSkillsSection(sections.skills ?? []);
    return { name, email, phone, skills, education, pastExperience, rawText };
  }

  private splitIntoSections(lines: string[]): Record<string, string[]> {
    const sections: Record<string, string[]> = {};
    let current: string | null = null;
    for (const line of lines) {
      const matchedKey = Object.entries(SECTION_HEADERS).find(([, re]) => re.test(line))?.[0];
      if (matchedKey) { current = matchedKey; sections[current] = []; continue; }
      if (current) sections[current].push(line);
    }
    return sections;
  }

  private parseExperienceSection(lines: string[]) {
    const entries: ParsedCvResult['pastExperience'] = [];
    let current: any = null;
    for (const line of lines) {
      const dateMatch = line.match(DATE_RANGE_REGEX);
      if (dateMatch) {
        if (current) entries.push(current);
        current = { startDate: dateMatch[1], endDate: dateMatch[2], title: line.replace(DATE_RANGE_REGEX, '').trim() || undefined, employer: undefined, description: undefined };
      } else if (current) {
        if (!current.employer) { current.employer = line; }
        else { current.description = current.description ? `${current.description} ${line}` : line; }
      }
    }
    if (current) entries.push(current);
    return entries;
  }

  private parseEducationSection(lines: string[]) {
    const entries: ParsedCvResult['education'] = [];
    let current: any = null;
    for (const line of lines) {
      const yearMatch = line.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) {
        if (current) entries.push(current);
        current = { year: yearMatch[0], qualification: line.replace(yearMatch[0], '').trim() || undefined };
      } else if (current && !current.institution) { current.institution = line; }
    }
    if (current) entries.push(current);
    return entries;
  }

  private parseSkillsSection(lines: string[]): string[] {
    return lines.join(', ').split(/[,•|]/).map(s => s.trim()).filter(s => s.length > 1 && s.length < 40);
  }
}
