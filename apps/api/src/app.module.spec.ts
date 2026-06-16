import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module';

describe('AppModule', () => {
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
  });

  it('should compile the application module', () => {
    expect(module).toBeDefined();
  });

  it('should have a reference to AppModule', () => {
    expect(module.get(AppModule)).toBeDefined();
  });

  afterAll(async () => {
    await module.close();
  });
});
