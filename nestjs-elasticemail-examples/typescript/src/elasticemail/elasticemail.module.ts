import { Global, Module } from "@nestjs/common";
import { ElasticEmailService } from "./elasticemail.service";

@Global()
@Module({
  providers: [ElasticEmailService],
  exports: [ElasticEmailService],
})
export class ElasticEmailModule {}
