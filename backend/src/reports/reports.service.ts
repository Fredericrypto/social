import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report, ReportReason } from './entities/report.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepo: Repository<Report>,
  ) {}

  async reportPost(reporterId: string, postId: string, reason: ReportReason, description?: string) {
    const report = this.reportRepo.create({ reporterId, postId, reason, description });
    return this.reportRepo.save(report);
  }

  async reportUser(reporterId: string, reportedUserId: string, reason: ReportReason, description?: string) {
    const report = this.reportRepo.create({ reporterId, reportedUserId, reason, description });
    return this.reportRepo.save(report);
  }
}
